from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import os
import threading
import time
from datetime import datetime
import json
import cv2
import queue
import base64
from io import BytesIO
from PIL import Image
import requests
import ssl
import urllib3
from video_processor import VideoProcessor

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
ssl._create_default_https_context = ssl._create_unverified_context

app = Flask(__name__)
CORS(app)

# Initialize video processor
video_processor = VideoProcessor()

# Global state management
app_state = {
    'live_tracking_active': False,
    'live_cap': None,
    'current_live_frame': None,
    'frame_accumulator': [],
    'live_reports': [],
    'video_context': None,
    'live_video_context': None,
    'last_processed_context': None,  # NEW: Store the last processed context (live or uploaded)
    'chat_history': [],
    'anomaly_notifications': [],
    'system_stats': {
        'accidents': 0,
        'active_cameras': 24,
        'ai_scanned': 4294,
        'uptime': 99.8
    },
    # Background worker control
    'workers_active': False,
    'worker_threads': []
}

# Thread-safe queues
live_analysis_queue = queue.Queue()
live_anomaly_queue = queue.Queue()

# ===== SYSTEM STATUS ENDPOINTS =====

@app.route('/api/status', methods=['GET'])
def get_system_status():
    """Get current system status"""
    return jsonify({
        'live_tracking_active': app_state['live_tracking_active'],
        'accidents': app_state['system_stats']['accidents'],
        'active_cameras': app_state['system_stats']['active_cameras'],
        'ai_scanned': app_state['system_stats']['ai_scanned'],
        'uptime': app_state['system_stats']['uptime'],
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/activity', methods=['GET'])
def get_recent_activity():
    """Get recent activity for dashboard"""
    activities = [
        {
            'id': 1,
            'type': 'accident',
            'icon': 'fas fa-exclamation-triangle',
            'title': 'New incident detected',
            'message': 'Crowd on camera M2',
            'timestamp': '2 minutes ago',
            'read': False
        },
        {
            'id': 2,
            'type': 'camera',
            'icon': 'fas fa-video-slash',
            'title': 'Connection renewed',
            'message': 'camera M25',
            'timestamp': '5 minutes ago',
            'read': False
        },
        {
            'id': 3,
            'type': 'accident',
            'icon': 'fas fa-exclamation-triangle',
            'title': 'New incident detected',
            'message': 'Smoke on camera M17',
            'timestamp': '12 minutes ago',
            'read': False
        },
        {
            'id': 4,
            'type': 'camera',
            'icon': 'fas fa-video-slash',
            'title': 'Lost connection',
            'message': 'camera M25',
            'timestamp': '18 minutes ago',
            'read': True
        },
        {
            'id': 5,
            'type': 'camera',
            'icon': 'fas fa-video-slash',
            'title': 'Lost connection',
            'message': 'camera M17',
            'timestamp': '25 minutes ago',
            'read': True
        }
    ]
    
    return jsonify({
        'items': activities,
        'timestamp': datetime.now().isoformat()
    })

# ===== VIDEO ANALYSIS ENDPOINTS =====

@app.route('/api/video/analyze', methods=['POST'])
def analyze_video():
    """Analyze uploaded video for content"""
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No video file selected'}), 400
        
        # Save uploaded file temporarily
        upload_path = os.path.join('uploads', f'temp_{int(time.time())}_{file.filename}')
        os.makedirs('uploads', exist_ok=True)
        file.save(upload_path)
        
        try:
            # Process video
            result = video_processor.analyze_video(upload_path)
            
            # Store context for chat
            video_context = {
                'type': 'analysis',
                'source': 'uploaded',
                'summary': result['summary'],
                'frames': result.get('key_frames', []),
                'filename': file.filename,
                'timestamp': datetime.now().isoformat()
            }
            
            app_state['video_context'] = video_context
            # IMPORTANT: Update last processed context
            app_state['last_processed_context'] = video_context
            
            # Clean up
            if os.path.exists(upload_path):
                os.remove(upload_path)
            
            return jsonify({
                'success': True,
                'report': result['summary'],
                'video_url': result.get('output_video'),
                'processing_time': result.get('processing_time', 0),
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            # Clean up on error
            if os.path.exists(upload_path):
                os.remove(upload_path)
            raise e
        
    except Exception as e:
        return jsonify({
            'error': f'Video analysis failed: {str(e)}'
        }), 500

@app.route('/api/video/anomaly', methods=['POST'])
def detect_anomalies():
    """Detect anomalies in uploaded video"""
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No video file selected'}), 400
        
        # Save uploaded file temporarily
        upload_path = os.path.join('uploads', f'temp_anomaly_{int(time.time())}_{file.filename}')
        os.makedirs('uploads', exist_ok=True)
        file.save(upload_path)
        
        try:
            # Process video for anomalies
            result = video_processor.detect_anomalies(upload_path)
            
            # Store context for chat
            video_context = {
                'type': 'anomaly',
                'source': 'uploaded',
                'summary': result['summary'],
                'frames': result.get('key_frames', []),
                'filename': file.filename,
                'timestamp': datetime.now().isoformat()
            }
            
            app_state['video_context'] = video_context
            # IMPORTANT: Update last processed context
            app_state['last_processed_context'] = video_context
            
            # Update incident count if anomalies detected
            if not result['summary'].lower().startswith('no significant anomalies'):
                app_state['system_stats']['accidents'] += 1
                
                # Add to notifications
                app_state['anomaly_notifications'].append({
                    'id': len(app_state['anomaly_notifications']) + 1,
                    'message': 'Anomaly detected in uploaded video',
                    'details': result['summary'][:100] + '...' if len(result['summary']) > 100 else result['summary'],
                    'timestamp': datetime.now().isoformat()
                })
            
            # Clean up
            if os.path.exists(upload_path):
                os.remove(upload_path)
            
            return jsonify({
                'success': True,
                'report': result['summary'],
                'video_url': result.get('output_video'),
                'processing_time': result.get('processing_time', 0),
                'anomalies_detected': not result['summary'].lower().startswith('no significant anomalies'),
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            # Clean up on error
            if os.path.exists(upload_path):
                os.remove(upload_path)
            raise e
        
    except Exception as e:
        return jsonify({
            'error': f'Anomaly detection failed: {str(e)}'
        }), 500

# ===== LIVE MONITORING ENDPOINTS =====

@app.route('/api/live/start', methods=['POST'])
def start_live_monitoring():
    """Start live camera monitoring"""
    try:
        if app_state['live_tracking_active']:
            return jsonify({'error': 'Live monitoring already active'}), 400
        
        # Initialize camera
        success, message = video_processor.start_live_tracking()
        
        if success:
            app_state['live_tracking_active'] = True
            app_state['live_cap'] = video_processor.live_cap
            
            # Start background workers with proper control
            start_live_workers()
            
            return jsonify({
                'success': True,
                'message': 'Live monitoring started successfully',
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'error': message
            }), 500
            
    except Exception as e:
        return jsonify({
            'error': f'Failed to start live monitoring: {str(e)}'
        }), 500

@app.route('/api/live/stop', methods=['POST'])
def stop_live_monitoring():
    """Stop live camera monitoring"""
    try:
        # Stop workers first
        stop_live_workers()
        
        # IMPORTANT: Before stopping, preserve the live video context as last processed
        if app_state['live_video_context']:
            # Convert live context to a permanent context
            last_live_context = {
                'type': app_state['live_video_context']['type'],
                'source': 'live_stopped',
                'summary': app_state['live_video_context']['summary'],
                'timestamp': app_state['live_video_context']['timestamp'],
                'stopped_at': datetime.now().isoformat()
            }
            app_state['last_processed_context'] = last_live_context
        
        # Stop video processor
        video_processor.stop_live_tracking()
        
        # Reset live state but preserve last processed context
        app_state['live_tracking_active'] = False
        app_state['live_cap'] = None
        app_state['current_live_frame'] = None
        app_state['live_video_context'] = None  # Clear current live context
        
        return jsonify({
            'success': True,
            'message': 'Live monitoring stopped',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to stop live monitoring: {str(e)}'
        }), 500

@app.route('/api/live/frame', methods=['GET'])
def get_live_frame():
    """Get current live camera frame"""
    try:
        if not app_state['live_tracking_active']:
            return jsonify({'error': 'Live monitoring not active'}), 400
        
        frame = video_processor.get_current_frame()
        if frame is not None:
            # Encode frame as base64 for web display
            _, buffer = cv2.imencode('.jpg', frame)
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            
            return jsonify({
                'success': True,
                'frame': f'data:image/jpeg;base64,{frame_base64}',
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'error': 'No frame available'
            }), 404
            
    except Exception as e:
        return jsonify({
            'error': f'Failed to get live frame: {str(e)}'
        }), 500

@app.route('/api/live/analyze', methods=['POST'])
def analyze_live_feed():
    """Analyze current live feed"""
    try:
        if not app_state['live_tracking_active']:
            return jsonify({'error': 'Live monitoring not active'}), 400
        
        result = video_processor.analyze_live_feed()
        
        # Add to live reports
        report_entry = {
            'id': len(app_state['live_reports']) + 1,
            'type': 'analysis',
            'content': result,
            'timestamp': datetime.now().isoformat()
        }
        app_state['live_reports'].insert(0, report_entry)
        
        # Update live video context for chat
        live_context = {
            'type': 'live_analysis',
            'source': 'live',
            'summary': result,
            'timestamp': datetime.now().isoformat()
        }
        
        app_state['live_video_context'] = live_context
        # IMPORTANT: Also update as last processed context
        app_state['last_processed_context'] = live_context
        
        # Keep only last 50 reports
        app_state['live_reports'] = app_state['live_reports'][:50]
        
        return jsonify({
            'success': True,
            'report': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Live analysis failed: {str(e)}'
        }), 500

@app.route('/api/live/anomaly', methods=['POST'])
def check_live_anomalies():
    """Check for anomalies in current live feed"""
    try:
        if not app_state['live_tracking_active']:
            return jsonify({'error': 'Live monitoring not active'}), 400
        
        result = video_processor.check_live_anomalies()
        
        # Add to live reports
        report_entry = {
            'id': len(app_state['live_reports']) + 1,
            'type': 'anomaly',
            'content': result,
            'timestamp': datetime.now().isoformat()
        }
        app_state['live_reports'].insert(0, report_entry)
        
        # Check if anomalies detected
        anomalies_detected = not result.lower().startswith('no significant anomalies')
        if anomalies_detected:
            app_state['system_stats']['accidents'] += 1
            
            # Add to notifications
            app_state['anomaly_notifications'].append({
                'id': len(app_state['anomaly_notifications']) + 1,
                'message': 'Live anomaly detected',
                'details': result[:100] + '...' if len(result) > 100 else result,
                'timestamp': datetime.now().isoformat()
            })
        
        # Update live video context for chat
        live_context = {
            'type': 'live_anomaly',
            'source': 'live',
            'summary': result,
            'timestamp': datetime.now().isoformat(),
            'anomalies_detected': anomalies_detected
        }
        
        app_state['live_video_context'] = live_context
        # IMPORTANT: Also update as last processed context
        app_state['last_processed_context'] = live_context
        
        # Keep only last 50 reports
        app_state['live_reports'] = app_state['live_reports'][:50]
        
        return jsonify({
            'success': True,
            'report': result,
            'anomalies_detected': anomalies_detected,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Live anomaly check failed: {str(e)}'
        }), 500

@app.route('/api/live/reports', methods=['GET'])
def get_live_reports():
    """Get live monitoring reports"""
    return jsonify({
        'reports': app_state['live_reports'],
        'timestamp': datetime.now().isoformat()
    })

# ===== CHAT ENDPOINTS =====

@app.route('/api/chat/message', methods=['POST'])
def process_chat_message():
    """Process chat message with AI - IMPROVED VERSION"""
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'error': 'No message provided'}), 400
        
        user_message = data['message'].strip()
        if not user_message:
            return jsonify({'error': 'Empty message'}), 400
        
        # Determine which context to use with improved priority logic
        video_context = None
        context_source = None
        
        # Priority 1: Active live video context (if live monitoring is running)
        if (app_state['live_tracking_active'] and 
            app_state['live_video_context']):
            video_context = app_state['live_video_context']
            context_source = 'live'
        
        # Priority 2: Last processed context (covers stopped live or uploaded videos)
        elif app_state['last_processed_context']:
            video_context = app_state['last_processed_context']
            context_source = video_context.get('source', 'unknown')
        
        # Priority 3: Any uploaded video context
        elif app_state['video_context']:
            video_context = app_state['video_context']
            context_source = 'uploaded'
        
        # Generate response
        if not video_context:
            response = """I don't have any video analysis context available yet. To get started:

• Upload and analyze a video in the 'Video Analysis' section, or
• Start live monitoring and analyze the live feed

Once you have processed some video content, I'll be able to answer questions about it!"""
            context_source = None
        else:
            # Process with video context using improved prompt
            response = video_processor.process_chat_question(
                user_message, 
                video_context,
                context_source
            )
        
        # Add to chat history
        app_state['chat_history'].append({
            'role': 'user',
            'content': user_message,
            'timestamp': datetime.now().isoformat()
        })
        app_state['chat_history'].append({
            'role': 'assistant',
            'content': response,
            'timestamp': datetime.now().isoformat(),
            'context_source': context_source
        })
        
        # Keep only last 20 exchanges (40 messages)
        if len(app_state['chat_history']) > 40:
            app_state['chat_history'] = app_state['chat_history'][-40:]
        
        return jsonify({
            'success': True,
            'response': response,
            'context_source': context_source,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Chat processing error: {e}")
        return jsonify({
            'error': f'Chat processing failed: {str(e)}'
        }), 500

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    """Get chat history"""
    return jsonify({
        'history': app_state['chat_history'],
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/chat/clear', methods=['POST'])
def clear_chat_history():
    """Clear chat history"""
    app_state['chat_history'] = []
    return jsonify({
        'success': True,
        'message': 'Chat history cleared',
        'timestamp': datetime.now().isoformat()
    })

# ===== CONTEXT STATUS ENDPOINT =====

@app.route('/api/chat/context', methods=['GET'])
def get_chat_context_status():
    """Get current chat context status for frontend"""
    return jsonify({
        'has_live_active': app_state['live_tracking_active'],
        'has_live_context': app_state['live_video_context'] is not None,
        'has_uploaded_context': app_state['video_context'] is not None,
        'has_last_processed': app_state['last_processed_context'] is not None,
        'current_context_source': (
            'live' if app_state['live_tracking_active'] and app_state['live_video_context'] else
            app_state['last_processed_context'].get('source') if app_state['last_processed_context'] else
            'uploaded' if app_state['video_context'] else
            None
        ),
        'timestamp': datetime.now().isoformat()
    })

# ===== NOTIFICATION ENDPOINTS =====

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    """Get anomaly notifications"""
    return jsonify({
        'notifications': app_state['anomaly_notifications'],
        'count': len(app_state['anomaly_notifications']),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/notifications/clear', methods=['POST'])
def clear_notifications():
    """Clear all notifications"""
    app_state['anomaly_notifications'] = []
    return jsonify({
        'success': True,
        'message': 'Notifications cleared',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read(notification_id):
    """Mark specific notification as read"""
    for notification in app_state['anomaly_notifications']:
        if notification['id'] == notification_id:
            notification['read'] = True
            break
    
    return jsonify({
        'success': True,
        'message': 'Notification marked as read',
        'timestamp': datetime.now().isoformat()
    })

# ===== BACKGROUND WORKERS =====

def start_live_workers():
    """Start background workers for live monitoring with proper control"""
    
    # Set workers as active
    app_state['workers_active'] = True
    app_state['worker_threads'] = []
    
    def live_analysis_worker():
        """Background worker for periodic analysis - EVERY 20 SECONDS"""
        last_analysis = time.time()
        
        while app_state['workers_active'] and app_state['live_tracking_active']:
            try:
                current_time = time.time()
                
                # Analyze every 20 seconds (not every second!)
                if current_time - last_analysis >= 20:
                    if app_state['live_tracking_active']:  # Double check
                        result = video_processor.analyze_live_feed()
                        
                        if result:
                            report_entry = {
                                'id': len(app_state['live_reports']) + 1,
                                'type': 'auto_analysis',
                                'content': f"AUTOMATIC ANALYSIS [{datetime.now().strftime('%H:%M:%S')}]\n" + 
                                          "=" * 40 + "\n" + result,
                                'timestamp': datetime.now().isoformat()
                            }
                            app_state['live_reports'].insert(0, report_entry)
                            app_state['live_reports'] = app_state['live_reports'][:50]
                            
                            # Update live video context
                            live_context = {
                                'type': 'live_analysis',
                                'source': 'live',
                                'summary': result,
                                'timestamp': datetime.now().isoformat()
                            }
                            app_state['live_video_context'] = live_context
                            app_state['last_processed_context'] = live_context
                    
                    last_analysis = current_time
                
                # Sleep for 2 seconds between checks
                time.sleep(2)
                
            except Exception as e:
                print(f"Error in live analysis worker: {e}")
                if app_state['workers_active']:
                    time.sleep(5)
                else:
                    break
    
    def live_anomaly_worker():
        """Background worker for anomaly detection - EVERY 10 SECONDS"""
        last_check = time.time()
        
        while app_state['workers_active'] and app_state['live_tracking_active']:
            try:
                current_time = time.time()
                
                # Check for anomalies every 10 seconds (not every second!)
                if current_time - last_check >= 10:
                    if app_state['live_tracking_active']:  # Double check
                        result = video_processor.check_live_anomalies()
                        
                        if result and not result.lower().startswith('no significant anomalies'):
                            app_state['system_stats']['accidents'] += 1
                            
                            report_entry = {
                                'id': len(app_state['live_reports']) + 1,
                                'type': 'auto_anomaly',
                                'content': f"ANOMALY ALERT [{datetime.now().strftime('%H:%M:%S')}]\n" + 
                                          "=" * 40 + "\n" + result,
                                'timestamp': datetime.now().isoformat()
                            }
                            app_state['live_reports'].insert(0, report_entry)
                            
                            # Add notification
                            app_state['anomaly_notifications'].append({
                                'id': len(app_state['anomaly_notifications']) + 1,
                                'message': 'Live anomaly detected',
                                'details': result[:100] + '...' if len(result) > 100 else result,
                                'timestamp': datetime.now().isoformat(),
                                'read': False
                            })
                            
                            # Update live video context
                            live_context = {
                                'type': 'live_anomaly',
                                'source': 'live',
                                'summary': result,
                                'timestamp': datetime.now().isoformat(),
                                'anomalies_detected': True
                            }
                            app_state['live_video_context'] = live_context
                            app_state['last_processed_context'] = live_context
                    
                    last_check = current_time
                
                # Sleep for 2 seconds between checks
                time.sleep(2)
                
            except Exception as e:
                print(f"Error in live anomaly worker: {e}")
                if app_state['workers_active']:
                    time.sleep(5)
                else:
                    break
    
    # Start workers in background threads
    analysis_thread = threading.Thread(target=live_analysis_worker, daemon=True)
    anomaly_thread = threading.Thread(target=live_anomaly_worker, daemon=True)
    
    analysis_thread.start()
    anomaly_thread.start()
    
    # Store thread references
    app_state['worker_threads'] = [analysis_thread, anomaly_thread]

def stop_live_workers():
    """Stop background workers cleanly"""
    app_state['workers_active'] = False
    
    # Wait for threads to finish (max 5 seconds)
    for thread in app_state['worker_threads']:
        if thread.is_alive():
            thread.join(timeout=5)
    
    app_state['worker_threads'] = []

# ===== STATIC FILE SERVING =====

@app.route('/api/video/<filename>')
def serve_video(filename):
    """Serve processed video files"""
    try:
        video_path = os.path.join('outputs', filename)
        if os.path.exists(video_path):
            return send_file(video_path, as_attachment=False)
        else:
            return jsonify({'error': 'Video not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== ERROR HANDLERS =====

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(413)
def too_large(error):
    return jsonify({'error': 'File too large'}), 413

# ===== CLEANUP ON EXIT =====

import atexit

def cleanup_on_exit():
    """Clean up resources on application exit"""
    print("Cleaning up resources...")
    stop_live_workers()
    if video_processor:
        video_processor.stop_live_tracking()

atexit.register(cleanup_on_exit)

# ===== MAIN =====

if __name__ == '__main__':
    # Create necessary directories
    os.makedirs('uploads', exist_ok=True)
    os.makedirs('outputs', exist_ok=True)
    
    print("Starting Video Analysis Backend Server...")
    print("- API Server: http://localhost:5000")
    print("- Dashboard should be served separately on http://localhost:8080")
    print("- Make sure to serve the frontend files with a web server")
    
    # Configure Flask
    app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size
    
    # Run the app
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,
        threaded=True
    )