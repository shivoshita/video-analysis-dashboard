import cv2
import numpy as np
import time
import base64
import requests
import json
from io import BytesIO
from PIL import Image
import ssl
import urllib3
import threading
from datetime import datetime
import queue
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import uvicorn
import tempfile
import os

# Disable SSL warnings and configure SSL context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
ssl._create_default_https_context = ssl._create_unverified_context

# NVIDIA API Configuration
NVIDIA_API_KEY = "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"
VILA_API_URL = "https://ai.api.nvidia.com/v1/vlm/nvidia/vila"

app = FastAPI(title="VILA Video Analyzer API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("VILA model will be used via NVIDIA API for video analysis and summarization")

# Global variables for live tracking
live_tracking_active = False
live_cap = None
live_frame_buffer = []
live_analysis_queue = queue.Queue()
live_anomaly_queue = queue.Queue()
last_analysis_time = 0
frame_accumulator = []
current_live_frame = None
live_reports_content = ""
processing_interval_seconds = 15  # Default 15 seconds
# Context storage for intelligent chat
live_video_context = {
    "current_activity": "",
    "recent_analysis": "",
    "anomaly_history": [],
    "scene_description": "",
    "people_count": 0,
    "objects_detected": [],
    "environment_type": "",
    "last_updated": None
}

uploaded_video_context = {
    "video_summary": "",
    "anomaly_report": "",
    "technical_details": {},
    "key_findings": [],
    "duration": 0,
    "last_analyzed": None
}

# ---- Helper Functions ----
def encode_frame_to_base64(frame):
    """Convert OpenCV frame to base64 string for API"""
    try:
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb)
        
        # Resize for API efficiency
        pil_image = pil_image.resize((512, 384))
        
        buffer = BytesIO()
        pil_image.save(buffer, format="JPEG", quality=90)
        encoded_string = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{encoded_string}"
    except Exception as e:
        print(f"Error encoding frame: {e}")
        return None

def make_vila_request(payload):
    """Make request to VILA API with error handling"""
    try:
        headers = {
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Content-Type": "application/json"
        }
        
        session = requests.Session()
        session.verify = False
        
        response = session.post(VILA_API_URL, headers=headers, json=payload, timeout=120)
        
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content'].strip()
        else:
            print(f"VILA API Error: {response.status_code} - {response.text}")
            return f"API Error ({response.status_code}): Could not analyze video with VILA"
            
    except requests.exceptions.SSLError as ssl_err:
        print(f"SSL Error with VILA API: {ssl_err}")
        return "SSL Error: Could not connect to VILA API"
    except requests.exceptions.RequestException as req_err:
        print(f"Request Error with VILA API: {req_err}")
        return "Network Error: Could not reach VILA API"
    except Exception as e:
        print(f"Error in VILA request: {e}")
        return f"Request Error: {str(e)}"

def update_live_context(analysis_result, context_type="analysis"):
    """Update live video context for intelligent chat"""
    global live_video_context
    
    try:
        current_time = datetime.now()
        
        if context_type == "analysis":
            live_video_context["recent_analysis"] = analysis_result
            live_video_context["current_activity"] = analysis_result[:200] + "..."
        elif context_type == "anomaly":
            live_video_context["anomaly_history"].append({
                "timestamp": current_time.isoformat(),  # Convert to string
                "description": analysis_result
            })
            # Keep only last 10 anomalies
            if len(live_video_context["anomaly_history"]) > 10:
                live_video_context["anomaly_history"] = live_video_context["anomaly_history"][-10:]
        
        live_video_context["last_updated"] = current_time.isoformat()  # Convert to string
        
    except Exception as e:
        print(f"Error updating live context: {e}")

def update_uploaded_context(summary, anomalies, duration, technical_details):
    """Update uploaded video context for intelligent chat"""
    global uploaded_video_context
    
    uploaded_video_context.update({
        "video_summary": summary,
        "anomaly_report": anomalies,
        "duration": duration,
        "technical_details": technical_details,
        "last_analyzed": datetime.now().isoformat()  # Convert to string
    })

def analyze_video_with_vila(key_frames, video_duration):
    """Use VILA to analyze and summarize the entire video"""
    try:
                # Get custom anomalies for analysis context
        custom_anomalies = get_custom_anomalies()
        custom_context = ""
        if custom_anomalies:
            custom_context = f"\n\nIMPORTANT: Also look for these USER-CONFIGURED CUSTOM ANOMALIES:\n"
            for anomaly in custom_anomalies:
                custom_context += f"- {anomaly['name']}: {anomaly['description']} (Priority: {anomaly['criticality'].upper()})\n"
        if len(key_frames) < 3:
            return "Insufficient frames for analysis"
        
        # Encode key frames to base64
        encoded_frames = []
        for frame in key_frames:
            encoded_frame = encode_frame_to_base64(frame)
            if encoded_frame:
                encoded_frames.append(encoded_frame)
        
        if not encoded_frames:
            return "Error: Could not encode frames for analysis"
        
        # Create comprehensive prompt for video analysis
        prompt = f"""Analyze this sequence of {len(encoded_frames)} frames from a {video_duration:.1f}-second video. Provide a detailed summary of:

1. What activities and actions are happening in the video?
2. How many people are visible and what are they doing?
3. What is the setting/environment?
4. Are there any notable movements, interactions, or changes over time?
5. Overall description of the scene and story.{custom_context}

Please write a natural, flowing description as if you're describing the video to someone who can't see it."""

        # Prepare the request payload
        payload = {
            "model": "nvidia/vila",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ] + [
                        {
                            "type": "image_url",
                            "image_url": {"url": frame}
                        } for frame in encoded_frames
                    ]
                }
            ],
            "max_tokens": 500,
            "temperature": 0.3,
            "stream": False
        }
        
        print("Sending frames to VILA for comprehensive video analysis...")
        result = make_vila_request(payload)
        
        # Update context if this is live video
        if live_tracking_active:
            update_live_context(result, "analysis")
        
        return result
        
    except Exception as e:
        print(f"Error in VILA video analysis: {e}")
        return f"Analysis Error: {str(e)}"

def detect_anomalies_with_vila(key_frames, video_duration):
    """Use VILA to detect anomalies and unusual events in the video"""
    try:
        if len(key_frames) < 3:
            return "Insufficient frames for anomaly detection"
        
        # Encode key frames to base64
        encoded_frames = []
        for frame in key_frames:
            encoded_frame = encode_frame_to_base64(frame)
            if encoded_frame:
                encoded_frames.append(encoded_frame)
        
        if not encoded_frames:
            return "Error: Could not encode frames for anomaly detection"
        
        # Get custom anomalies from settings
        custom_anomalies = get_custom_anomalies()
        custom_anomaly_text = ""

        if custom_anomalies:
            custom_anomaly_text = "\n\n🔧 USER-CONFIGURED CUSTOM ANOMALIES TO DETECT:\n"
            for anomaly in custom_anomalies:
                priority_indicator = "🔴" if anomaly['criticality'] == 'high' else "🟡" if anomaly['criticality'] == 'medium' else "🟢"
                custom_anomaly_text += f"{priority_indicator} {anomaly['name']}: {anomaly['description']}\n"
            custom_anomaly_text += "\nIMPORTANT: Check specifically for these custom anomalies and report them clearly if found.\n"
        
        # Create specific prompt for anomaly detection
        # Create specific prompt for anomaly detection
        prompt = f"""Analyze this sequence of {len(encoded_frames)} frames from a {video_duration:.1f}-second video and provide a detailed anomaly detection report.

        🚨 DETECT THESE STANDARD ANOMALIES:
        - Objects falling (boxes, items, equipment)
        - People falling, tripping, or stumbling  
        - Equipment malfunctions or failures
        - Spills, breaks, or structural damage
        - Collisions or impacts
        - Unusual behavior or safety incidents
        - Loitering in sensitive zones
        - Theft/shoplifting or concealment behavior
        - Unattended objects or packages
        - Crowd formations in restricted areas
        - Violence, fights, or physical altercations
        - Intrusion during non-operational hours
        - Suspicious or erratic movement patterns
        - Vandalism or property damage
        - Camera blocking or tampering
        - Vehicle moving in wrong direction
        - Abandoned vehicles in unusual locations
        - Unusual speed (too fast movement)
        - Queue jumping or overcrowding
        - Missing protective gear (helmets, vests)
        - Unauthorized carrying of weapons/packages
        - Trespassing or fence climbing
        - Any disruption to normal operations{custom_anomaly_text}

        Provide your response in this EXACT format:

        **STANDARD ANOMALIES DETECTED:**
        [List each standard anomaly found with brief description, or write "None detected"]

        **CUSTOM ANOMALIES DETECTED:**
        [List each custom anomaly found with brief description, or write "None detected"]

        **OVERALL ASSESSMENT:**
        [Brief summary of scene safety and any recommendations]

        Be specific about WHAT you observe that matches each anomaly type. If no anomalies are found, state clearly that normal activity was observed."""

        # Prepare the request payload
        payload = {
            "model": "nvidia/vila",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ] + [
                        {
                            "type": "image_url",
                            "image_url": {"url": frame}
                        } for frame in encoded_frames
                    ]
                }
            ],
            "max_tokens": 600,
            "temperature": 0.2,
            "stream": False
        }
        
        print("Analyzing frames for anomalies (including custom) with VILA...")
        result = make_vila_request(payload)

        # Debug logging
        custom_anomalies = get_custom_anomalies()
        if custom_anomalies:
            print(f"DEBUG: Custom anomalies sent to VILA: {[a['name'] for a in custom_anomalies]}")
            print(f"DEBUG: VILA response includes custom check: {'CUSTOM ANOMALIES DETECTED' in result}")
        
        # Update context if this is live video and anomalies detected
        if live_tracking_active and "No significant anomalies detected" not in result:
            update_live_context(result, "anomaly")
        
        return result
        
    except Exception as e:
        print(f"Error in VILA anomaly detection: {e}")
        return f"Anomaly Detection Error: {str(e)}"

def get_custom_anomalies():
    """Retrieve custom anomalies from storage"""
    try:
        global custom_anomalies_storage
        # Filter only enabled anomalies
        enabled_anomalies = [a for a in custom_anomalies_storage if a.get('enabled', True)]
        print(f"Retrieved {len(enabled_anomalies)} enabled custom anomalies")
        return enabled_anomalies
    except Exception as e:
        print(f"Error retrieving custom anomalies: {e}")
        return []

# Global storage for custom anomalies (in production, use a database)
custom_anomalies_storage = []

def get_contextual_chat_response(user_message, include_frames=False):
    """Generate contextual chat response based on current video context"""
    try:
        # Determine context source
        context_info = ""
        
        # Check if live video is active
        if live_tracking_active and live_video_context.get("last_updated"):
            context_info += f"LIVE VIDEO CONTEXT:\n"
            context_info += f"Current Activity: {live_video_context.get('current_activity', 'No recent analysis')}\n"
            context_info += f"Recent Analysis: {live_video_context.get('recent_analysis', 'None')}\n"
            
            if live_video_context.get("anomaly_history"):
                context_info += f"Recent Anomalies: {len(live_video_context['anomaly_history'])} detected\n"
                for anomaly in live_video_context["anomaly_history"][-3:]:  # Last 3 anomalies
                    context_info += f"- {anomaly['description'][:100]}...\n"
            
            # last_updated is already a string, so parse it for display
            last_updated = datetime.fromisoformat(live_video_context['last_updated'])
            context_info += f"Last Updated: {last_updated.strftime('%H:%M:%S')}\n\n"
        
        # Check if uploaded video context exists
        elif uploaded_video_context.get("last_analyzed"):
            context_info += f"UPLOADED VIDEO CONTEXT:\n"
            context_info += f"Video Summary: {uploaded_video_context.get('video_summary', 'No summary available')}\n"
            context_info += f"Anomaly Report: {uploaded_video_context.get('anomaly_report', 'No anomalies reported')}\n"
            context_info += f"Duration: {uploaded_video_context.get('duration', 0):.1f} seconds\n"
            # last_analyzed is already a string, so parse it for display
            analyzed_time = datetime.fromisoformat(uploaded_video_context['last_analyzed'])
            context_info += f"Analyzed: {analyzed_time.strftime('%H:%M:%S')}\n\n"
        
        # Create enhanced prompt with context
        enhanced_prompt = f"""You are an AI assistant helping with video analysis. Answer the user's question based on the current video context.

{context_info}

USER QUESTION: {user_message}

Instructions:
- Answer specifically about what you can see/analyze in the current video context
- If the question relates to the video content, use the context information above
- If no relevant video context exists, explain that you need video analysis to be performed first
- Be conversational and helpful
- Focus on the specific video content and analysis results"""

        # Prepare payload for contextual response
        content = [{"type": "text", "text": enhanced_prompt}]
        
        # Optionally include current frame for visual context
        if include_frames and live_tracking_active and len(frame_accumulator) > 0:
            recent_frame = frame_accumulator[-1]
            encoded_frame = encode_frame_to_base64(recent_frame)
            if encoded_frame:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": encoded_frame}
                })

        payload = {
            "model": "nvidia/vila",
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ],
            "max_tokens": 400,
            "temperature": 0.7,
            "stream": False
        }
        
        return make_vila_request(payload)
        
    except Exception as e:
        print(f"Error in contextual chat: {e}")
        return f"Chat Error: {str(e)}"

def extract_key_frames(cap, total_frames, num_frames=12):
    """Extract key frames evenly distributed throughout the video"""
    key_frames = []
    
    try:
        if total_frames <= num_frames:
            frame_indices = list(range(total_frames))
        else:
            frame_indices = np.linspace(0, total_frames-1, num_frames, dtype=int)
        
        for frame_idx in frame_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if ret and frame is not None:
                key_frames.append(frame)
    except Exception as e:
        print(f"Error extracting frames: {e}")
    
    return key_frames

# ---- Live Video Functions ----
def live_frame_capture_worker():
    """Background worker to continuously capture frames and update display"""
    global current_live_frame, frame_accumulator, live_cap, processing_interval_seconds
    
    while live_tracking_active:
        try:
            if live_cap is not None:
                ret, frame = live_cap.read()
                if ret and frame is not None:
                    # Add frame to accumulator for analysis
                    frame_accumulator.append(frame.copy())
                    
                    # Keep accumulator manageable (last 20 seconds at 30fps = 600 frames)
                    if len(frame_accumulator) > 600:
                        frame_accumulator = frame_accumulator[-600:]
                    
                    # Add overlay to current frame
                    display_frame = frame.copy()
                    elapsed_time = time.time() - last_analysis_time if last_analysis_time > 0 else 0
                    
                    cv2.putText(display_frame, f"🔴 LIVE - {datetime.now().strftime('%H:%M:%S')}", 
                               (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    cv2.putText(display_frame, f"Frames: {len(frame_accumulator)} | Next: {processing_interval_seconds - (elapsed_time % processing_interval_seconds):.0f}s", 
                               (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
                    cv2.putText(display_frame, f"Analysis every {processing_interval_seconds}s | Anomaly check every 5s | Chat Available", 
                               (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)
                    
                    # Convert BGR to RGB for display
                    current_live_frame = cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB)
                    
            time.sleep(0.033)  # ~30 FPS
            
        except Exception as e:
            print(f"Error in frame capture worker: {e}")
            time.sleep(1)
def live_analysis_worker():
    """Background worker for periodic live video analysis (configurable interval)"""
    global frame_accumulator, last_analysis_time, live_analysis_queue, live_reports_content, processing_interval_seconds
    
    while live_tracking_active:
        try:
            current_time = time.time()
            
            # Check if the configured interval has passed since last analysis
            if current_time - last_analysis_time >= processing_interval_seconds and len(frame_accumulator) >= 5:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Starting {processing_interval_seconds}-second analysis...")
                
                # Select frames from accumulator
                step = max(1, len(frame_accumulator) // 10)
                analysis_frames = frame_accumulator[::step][:10]
                
                if analysis_frames:
                    # Perform analysis
                    analysis_result = analyze_video_with_vila(analysis_frames, float(processing_interval_seconds))
                    
                    # Create timestamped report
                    timestamp = datetime.now().strftime('%H:%M:%S')
                    report = f"📹 LIVE ANALYSIS [{timestamp}]\n"
                    report += "=" * 40 + "\n"
                    report += f"Frames analyzed: {len(analysis_frames)}\n"
                    report += f"Time period: {processing_interval_seconds} seconds\n\n"
                    report += analysis_result + "\n\n"
                    
                    # Update global reports content
                    live_reports_content = report + live_reports_content
                    
                    # Send to queue for UI update
                    live_analysis_queue.put(("analysis", report))
                
                # Reset timer
                last_analysis_time = current_time
            
            time.sleep(1)
            
        except Exception as e:
            print(f"Error in live analysis worker: {e}")
            time.sleep(5)

def live_anomaly_worker():
    """Background worker for real-time anomaly detection"""
    global frame_accumulator, live_anomaly_queue, live_reports_content
    
    last_anomaly_check = time.time()
    
    while live_tracking_active:
        try:
            current_time = time.time()
            
            # Check for anomalies every 5 seconds
            if current_time - last_anomaly_check >= 5 and len(frame_accumulator) >= 3:
                # Take last 5 frames for anomaly detection
                recent_frames = frame_accumulator[-5:] if len(frame_accumulator) >= 5 else frame_accumulator
                
                if len(recent_frames) >= 3:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Checking for anomalies...")
                    
                    # Detect anomalies
                    anomaly_result = detect_anomalies_with_vila(recent_frames, 5.0)
                    
                    # Only report if anomalies detected
                    if "No significant anomalies detected" not in anomaly_result and "normal activity observed" not in anomaly_result.lower():
                        timestamp = datetime.now().strftime('%H:%M:%S')
                        alert = f"🚨 ANOMALY ALERT [{timestamp}]\n"
                        alert += "=" * 40 + "\n"
                        alert += anomaly_result + "\n\n"
                        
                        # Update global reports content
                        live_reports_content = alert + live_reports_content
                        
                        # Send to queue for UI update
                        live_anomaly_queue.put(("anomaly", alert))
                
                last_anomaly_check = current_time
            
            time.sleep(1)
            
        except Exception as e:
            print(f"Error in live anomaly worker: {e}")
            time.sleep(5)

# ---- API Endpoints ----

@app.post("/api/set-processing-interval")
async def set_processing_interval(data: dict):
    """Set the processing interval for live analysis"""
    global processing_interval_seconds
    
    try:
        interval = data.get("interval", 15)
        
        # Validate interval (between 5 and 60 seconds)
        if not isinstance(interval, (int, float)) or interval < 5 or interval > 60:
            raise HTTPException(status_code=400, detail="Interval must be between 5 and 60 seconds")
        
        processing_interval_seconds = int(interval)
        
        print(f"Processing interval updated to {processing_interval_seconds} seconds")
        
        return JSONResponse({
            "success": True,
            "message": f"Processing interval updated to {processing_interval_seconds} seconds",
            "interval": processing_interval_seconds
        })
        
    except Exception as e:
        print(f"Error setting processing interval: {e}")
        return JSONResponse({
            "success": False,
            "error": str(e)
        })
        
# Add this test endpoint to api_server.py
@app.get("/api/test-custom-anomalies")
async def test_custom_anomalies():
    """Test endpoint to verify custom anomaly detection"""
    custom_anomalies = get_custom_anomalies()
    
    return JSONResponse({
        "success": True,
        "custom_anomalies_count": len(custom_anomalies),
        "custom_anomalies": custom_anomalies,
        "test_prompt_preview": f"Custom anomalies would be added to prompt: {[a['name'] for a in custom_anomalies]}"
    })
    
@app.post("/api/upload-video-analysis")
async def upload_video_analysis(file: UploadFile = File(...)):
    """Process uploaded video for general analysis"""
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        cap = cv2.VideoCapture(tmp_file_path)
        
        if not cap.isOpened():
            os.unlink(tmp_file_path)
            raise HTTPException(status_code=400, detail="Could not open video file")
        
        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
        w = int(cap.get(3)) or 640
        h = int(cap.get(4)) or 480
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        duration = total_frames / fps if fps > 0 and total_frames > 0 else 0

        # Extract key frames for VILA analysis
        key_frames = extract_key_frames(cap, total_frames, num_frames=15)
        cap.release()
        os.unlink(tmp_file_path)

        if not key_frames:
            raise HTTPException(status_code=400, detail="Could not extract frames from video")

        # Analyze video with VILA
        vila_summary = analyze_video_with_vila(key_frames, duration)
        
        # Also get anomaly detection for uploaded video
        anomaly_report = detect_anomalies_with_vila(key_frames, duration)

        # Update uploaded video context
        technical_details = {
            "duration": duration,
            "total_frames": total_frames,
            "fps": fps,
            "resolution": f"{w}x{h}",
            "frames_analyzed": len(key_frames)
        }
        
        update_uploaded_context(vila_summary, anomaly_report, duration, technical_details)

        # Build summary
        summary = f"🎥 VIDEO ANALYSIS REPORT\n"
        summary += "=" * 50 + "\n\n"
        summary += f"📊 Technical Details:\n"
        summary += f"• Duration: {duration:.2f} seconds\n"
        summary += f"• Total Frames: {total_frames}\n"
        summary += f"• Frame Rate: {fps} FPS\n"
        summary += f"• Resolution: {w}x{h}\n\n"
        summary += f"🤖 VILA AI Analysis:\n"
        summary += "-" * 30 + "\n"
        summary += vila_summary + "\n\n"
        summary += f"📝 Analysis Method:\n"
        summary += f"• Analyzed {len(key_frames)} key frames using VILA\n"
        summary += f"• AI Model: NVIDIA VILA (Vision-Language Assistant)\n"
        summary += f"• Context available for chat queries\n"

        return JSONResponse({
            "success": True,
            "analysis": summary
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)
        
@app.get("/api/debug-custom-anomalies")
async def debug_custom_anomalies():
    """Debug endpoint to check custom anomalies"""
    global custom_anomalies_storage
    
    return JSONResponse({
        "success": True,
        "stored_anomalies": custom_anomalies_storage,
        "count": len(custom_anomalies_storage),
        "storage_type": type(custom_anomalies_storage).__name__
    })

@app.post("/api/upload-video-anomalies")
async def upload_video_anomalies(file: UploadFile = File(...)):
    """Process uploaded video for anomaly detection"""
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        cap = cv2.VideoCapture(tmp_file_path)
        
        if not cap.isOpened():
            os.unlink(tmp_file_path)
            raise HTTPException(status_code=400, detail="Could not open video file")
        
        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
        w = int(cap.get(3)) or 640
        h = int(cap.get(4)) or 480
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        duration = total_frames / fps if fps > 0 and total_frames > 0 else 0

        # Extract more key frames for better anomaly detection
        key_frames = extract_key_frames(cap, total_frames, num_frames=20)
        cap.release()
        os.unlink(tmp_file_path)

        if not key_frames:
            raise HTTPException(status_code=400, detail="Could not extract frames from video")

        # Detect anomalies with VILA
        anomaly_report = detect_anomalies_with_vila(key_frames, duration)
        
        # Also get general analysis for context
        general_analysis = analyze_video_with_vila(key_frames, duration)

        # Update uploaded video context
        technical_details = {
            "duration": duration,
            "total_frames": total_frames,
            "fps": fps,
            "resolution": f"{w}x{h}",
            "frames_analyzed": len(key_frames)
        }
        
        update_uploaded_context(general_analysis, anomaly_report, duration, technical_details)

        # Build Anomaly Report
        report = f"🚨 ANOMALY DETECTION SUMMARY\n"
        report += "=" * 50 + "\n\n"
        report += f"📊 Video Details:\n"
        report += f"• Duration: {duration:.2f} seconds ({total_frames} frames)\n"
        report += f"• Resolution: {w}x{h} @ {fps} FPS\n"
        report += f"• Frames Analyzed: {len(key_frames)} key frames\n\n"
        report += f"🤖 VILA Analysis Summary:\n"
        report += "-" * 30 + "\n"
        report += anomaly_report + "\n\n"
        report += f"⚙️ Detection Method: NVIDIA VILA AI • Focus: Safety & Incident Detection\n"
        report += f"💬 Context available for chat queries about this analysis\n"

        return JSONResponse({
            "success": True,
            "analysis": report
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)

@app.post("/api/start-live-tracking")
async def start_live_tracking():
    """Start live video tracking with camera"""
    global live_tracking_active, live_cap, last_analysis_time, frame_accumulator, current_live_frame, live_reports_content, live_video_context
    
    try:
        # Reset reports and context
        live_reports_content = ""
        live_video_context = {
            "current_activity": "",
            "recent_analysis": "",
            "anomaly_history": [],
            "scene_description": "",
            "people_count": 0,
            "objects_detected": [],
            "environment_type": "",
            "last_updated": None
        }
        
        # Try different camera indices
        camera_indices = [0, 1, 2]
        live_cap = None
        
        for idx in camera_indices:
            test_cap = cv2.VideoCapture(idx)
            if test_cap.isOpened():
                ret, test_frame = test_cap.read()
                if ret and test_frame is not None:
                    live_cap = test_cap
                    print(f"Successfully opened camera index {idx}")
                    break
                else:
                    test_cap.release()
            else:
                test_cap.release()
        
        if live_cap is None:
            return JSONResponse({
                "success": False,
                "error": "Could not access any camera. Please check camera permissions."
            })
        
        # Configure camera
        live_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        live_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        live_cap.set(cv2.CAP_PROP_FPS, 30)
        
        live_tracking_active = True
        last_analysis_time = time.time()
        frame_accumulator = []
        current_live_frame = None
        
        # Start background workers
        capture_thread = threading.Thread(target=live_frame_capture_worker, daemon=True)
        analysis_thread = threading.Thread(target=live_analysis_worker, daemon=True)
        anomaly_thread = threading.Thread(target=live_anomaly_worker, daemon=True)
        
        capture_thread.start()
        analysis_thread.start()
        anomaly_thread.start()
        
        status_msg = "✅ Live tracking started! Camera activated.\n\n"
        status_msg += "📊 Status: Collecting frames...\n"
        status_msg += f"🔄 Next analysis in {processing_interval_seconds} seconds\n"
        status_msg += "🚨 Anomaly detection: Active (every 5s)\n"
        status_msg += "💬 Chat: Ready for contextual queries"
        return JSONResponse({
            "success": True,
            "message": status_msg
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        })

@app.post("/api/save-custom-anomalies")
async def save_custom_anomalies(data: dict):
    """Save custom anomalies from settings page"""
    global custom_anomalies_storage
    
    try:
        anomalies = data.get("anomalies", [])
        
        # Validate anomalies structure
        for anomaly in anomalies:
            if not all(key in anomaly for key in ['name', 'description', 'type', 'criticality']):
                raise HTTPException(status_code=400, detail="Invalid anomaly structure")
        
        # Filter only enabled anomalies
        enabled_anomalies = [a for a in anomalies if a.get('enabled', True)]
        
        custom_anomalies_storage = enabled_anomalies
        
        print(f"Saved {len(enabled_anomalies)} custom anomalies for detection")
        
        return JSONResponse({
            "success": True,
            "message": f"Successfully saved {len(enabled_anomalies)} custom anomalies",
            "count": len(enabled_anomalies)
        })
        
    except Exception as e:
        print(f"Error saving custom anomalies: {e}")
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)

@app.get("/api/get-custom-anomalies")
async def get_custom_anomalies_api():
    """Get current custom anomalies"""
    global custom_anomalies_storage
    
    try:
        return JSONResponse({
            "success": True,
            "anomalies": custom_anomalies_storage,
            "count": len(custom_anomalies_storage)
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)

@app.post("/api/stop-live-tracking")
async def stop_live_tracking():
    """Stop live video tracking"""
    global live_tracking_active, live_cap, current_live_frame
    
    live_tracking_active = False
    
    if live_cap is not None:
        live_cap.release()
        live_cap = None
    
    current_live_frame = None
    
    return JSONResponse({
        "success": True,
        "message": "🛑 Live tracking stopped. Camera released."
    })

@app.get("/api/live-frame")
async def get_live_frame():
    """Get current frame from live camera"""
    global current_live_frame
    
    if not live_tracking_active or current_live_frame is None:
        return JSONResponse({
            "success": False,
            "error": "Live tracking not active or no frame available"
        })
    
    try:
        # Convert frame to base64 for transmission
        pil_image = Image.fromarray(current_live_frame)
        buffer = BytesIO()
        pil_image.save(buffer, format="JPEG", quality=90)
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return JSONResponse({
            "success": True,
            "frame": f"data:image/jpeg;base64,{img_str}"
        })
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        })

@app.get("/api/live-reports")
async def get_live_reports():
    """Get live analysis and anomaly updates"""
    global live_reports_content, processing_interval_seconds
    
    # Get new updates from queues
    new_updates = []
    
    # Get analysis updates
    while not live_analysis_queue.empty():
        try:
            update_type, content = live_analysis_queue.get_nowait()
            new_updates.append(content)
        except queue.Empty:
            break
    
    # Get anomaly updates
    while not live_anomaly_queue.empty():
        try:
            update_type, content = live_anomaly_queue.get_nowait()
            new_updates.append(content)
        except queue.Empty:
            break
    
    # If there are new updates, add them to the global content
    if new_updates:
        for update in new_updates:
            live_reports_content = update + live_reports_content
    
    # Return the current reports content
    if live_reports_content:
        content = live_reports_content
    else:
        content = f"📋 Live analysis reports will appear here...\n\n🔄 Automatic reports every {processing_interval_seconds} seconds\n🚨 Anomaly alerts as they happen\n📊 Manual analysis reports on demand\n💬 Chat available for contextual queries"
    
    return JSONResponse({
        "success": True,
        "reports": content
    })

@app.post("/api/live-analysis")
async def process_live_analysis():
    """Process analysis for live video"""
    global frame_accumulator, live_reports_content
    
    if not live_tracking_active:
        return JSONResponse({
            "success": False,
            "error": "Live tracking is not active. Please start live tracking first."
        })
    
    if len(frame_accumulator) < 5:
        return JSONResponse({
            "success": False,
            "error": "Not enough frames collected yet. Please wait a few more seconds."
        })
    
    try:
        # Take recent frames for immediate analysis
        recent_frames = frame_accumulator[-10:] if len(frame_accumulator) >= 10 else frame_accumulator
        
        analysis_result = analyze_video_with_vila(recent_frames, len(recent_frames) / 30.0)
        
        timestamp = datetime.now().strftime('%H:%M:%S')
        report = f"📹 INSTANT LIVE ANALYSIS [{timestamp}]\n"
        report += "=" * 45 + "\n"
        report += f"Frames analyzed: {len(recent_frames)}\n"
        report += f"Camera: Live camera feed\n\n"
        report += "🤖 VILA Analysis:\n"
        report += "-" * 20 + "\n"
        report += analysis_result + "\n\n"
        report += "💬 Context updated - Chat now available for queries\n\n"
        
        # Add to global reports
        live_reports_content = report + live_reports_content
        
        return JSONResponse({
            "success": True,
            "analysis": live_reports_content
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        })

@app.post("/api/live-anomaly")
async def process_live_anomaly():
    """Process anomaly detection for live video"""
    global frame_accumulator, live_reports_content
    
    if not live_tracking_active:
        return JSONResponse({
            "success": False,
            "error": "Live tracking is not active. Please start live tracking first."
        })
    
    if len(frame_accumulator) < 5:
        return JSONResponse({
            "success": False,
            "error": "Not enough frames collected yet. Please wait a few more seconds."
        })
    
    try:
        # Take recent frames for immediate anomaly detection
        recent_frames = frame_accumulator[-15:] if len(frame_accumulator) >= 15 else frame_accumulator
        
        anomaly_result = detect_anomalies_with_vila(recent_frames, len(recent_frames) / 30.0)
        
        timestamp = datetime.now().strftime('%H:%M:%S')
        report = f"🚨 INSTANT ANOMALY CHECK [{timestamp}]\n"
        report += "=" * 45 + "\n"
        report += f"Frames analyzed: {len(recent_frames)}\n"
        report += f"Camera: Live camera feed\n\n"
        report += "🔍 Anomaly Detection Results:\n"
        report += "-" * 30 + "\n"
        report += anomaly_result + "\n\n"
        report += "💬 Context updated - Ask chat about detected anomalies\n\n"
        
        # Add to global reports
        live_reports_content = report + live_reports_content
        
        return JSONResponse({
            "success": True,
            "analysis": live_reports_content
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        })

@app.post("/api/chat")
async def chat_with_vila(data: dict):
    """Enhanced chat interface with video context awareness"""
    try:
        user_message = data.get("message", "")
        include_current_frame = data.get("include_frame", False)  # Optional parameter
        
        if not user_message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        # Check if we have video context available
        has_live_context = live_tracking_active and live_video_context.get("last_updated")
        has_uploaded_context = uploaded_video_context.get("last_analyzed")
        
        if has_live_context or has_uploaded_context:
            # Use contextual chat response
            response = get_contextual_chat_response(user_message, include_current_frame)
            context_type = "live video" if has_live_context else "uploaded video"
        else:
            # Fallback to general chat if no video context
            payload = {
                "model": "nvidia/vila",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"You are a helpful AI assistant for video analysis. The user asked: '{user_message}'\n\nNote: No video analysis context is currently available. Please let them know they need to either start live video monitoring or upload a video for analysis first to get context-specific answers."
                            }
                        ]
                    }
                ],
                "max_tokens": 300,
                "temperature": 0.7,
                "stream": False
            }
            response = make_vila_request(payload)
            context_type = "general"
        
        return JSONResponse({
            "success": True,
            "response": response,
            "context_type": context_type,
            "has_live_context": has_live_context,
            "has_uploaded_context": has_uploaded_context,
            "timestamp": datetime.now().strftime('%H:%M:%S')
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        })

@app.post("/api/chat-with-frame")
async def chat_with_current_frame(data: dict):
    """Chat with current live frame for visual context"""
    try:
        user_message = data.get("message", "")
        
        if not user_message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        if not live_tracking_active:
            return JSONResponse({
                "success": False,
                "error": "Live tracking is not active. Please start live tracking first to use visual chat."
            })
        
        if len(frame_accumulator) == 0:
            return JSONResponse({
                "success": False,
                "error": "No frames available. Please wait for the camera to capture frames."
            })
        
        # Get current frame
        current_frame = frame_accumulator[-1]
        encoded_frame = encode_frame_to_base64(current_frame)
        
        if not encoded_frame:
            return JSONResponse({
                "success": False,
                "error": "Could not process current frame for chat."
            })
        
        # Create enhanced prompt with both context and visual
        context_info = ""
        if live_video_context.get("recent_analysis"):
            context_info = f"Recent analysis: {live_video_context['recent_analysis'][:200]}...\n"
        if live_video_context.get("anomaly_history"):
            context_info += f"Recent anomalies: {len(live_video_context['anomaly_history'])} detected\n"
        
        enhanced_prompt = f"""You are viewing the current live camera feed. Answer the user's question based on what you can see in the image and the recent analysis context.

{context_info}

USER QUESTION: {user_message}

Look at the current frame and provide a detailed answer based on what you can observe visually, combined with the context information."""

        payload = {
            "model": "nvidia/vila",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": enhanced_prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": encoded_frame}
                        }
                    ]
                }
            ],
            "max_tokens": 400,
            "temperature": 0.7,
            "stream": False
        }
        
        response = make_vila_request(payload)
        
        return JSONResponse({
            "success": True,
            "response": response,
            "context_type": "live_visual",
            "timestamp": datetime.now().strftime('%H:%M:%S'),
            "frame_included": True
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        })

@app.get("/api/context-status")
async def get_context_status():
    """Get current context status for chat system"""
    try:
        status = {
            "live_tracking_active": live_tracking_active,
            "live_context_available": live_video_context.get("last_updated") is not None,
            "uploaded_context_available": uploaded_video_context.get("last_analyzed") is not None,
            "live_frames_count": len(frame_accumulator) if live_tracking_active else 0,
            "live_anomalies_count": len(live_video_context.get("anomaly_history", [])),
        }
        
        if live_video_context.get("last_updated"):
            # last_updated is already a string now
            status["live_last_updated"] = live_video_context["last_updated"]
            status["live_activity_summary"] = live_video_context.get("current_activity", "")[:100]
        
        if uploaded_video_context.get("last_analyzed"):
            # last_analyzed is already a string now
            status["uploaded_last_analyzed"] = uploaded_video_context["last_analyzed"]
            status["uploaded_duration"] = uploaded_video_context.get("duration", 0)
        
        return JSONResponse({
            "success": True,
            "status": status
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        })

@app.get("/api/suggested-questions")
async def get_suggested_questions():
    """Get context-aware suggested questions for chat"""
    try:
        suggestions = []
        
        if live_tracking_active and live_video_context.get("last_updated"):
            suggestions.extend([
                "What is currently happening in the live video?",
                "How many people can you see right now?",
                "Describe the current scene and environment",
                "Are there any safety concerns in the current view?",
                "What activities are taking place?"
            ])
            
            if live_video_context.get("anomaly_history"):
                suggestions.extend([
                    "Tell me about the recent anomalies detected",
                    "What was the last unusual activity you noticed?",
                    "Are there any ongoing safety issues?"
                ])
        
        elif uploaded_video_context.get("last_analyzed"):
            suggestions.extend([
                "Summarize the main activities in the uploaded video",
                "What were the key findings from the analysis?",
                "Were there any anomalies or unusual events?",
                "How long was the video and what happened?",
                "Describe the people and objects in the video"
            ])
        
        else:
            suggestions.extend([
                "How do I start live video monitoring?",
                "What types of videos can I analyze?",
                "What anomalies can the system detect?",
                "How does the AI analysis work?",
                "What information do I get from video analysis?"
            ])
        
        return JSONResponse({
            "success": True,
            "suggestions": suggestions
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        })

if __name__ == "__main__":
    print("Starting VILA Video Analyzer API Server with Enhanced Chat...")
    print("🎥 Video Analysis: Upload videos or start live monitoring")
    print("🚨 Anomaly Detection: Real-time safety monitoring") 
    print("💬 Smart Chat: Context-aware queries about your video content")
    print("🔄 Live Updates: Automatic analysis every 20 seconds")
    print("👁️ Visual Chat: Ask questions about what you see right now")
    uvicorn.run(app, host="127.0.0.1", port=3000, log_level="info")