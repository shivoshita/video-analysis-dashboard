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
from datetime import datetime
import os

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
ssl._create_default_https_context = ssl._create_unverified_context

class VideoProcessor:
    def __init__(self):
        # NVIDIA API Configuration
        self.NVIDIA_API_KEY = "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"
        self.VILA_API_URL = "https://ai.api.nvidia.com/v1/vlm/nvidia/vila"
        
        # Live tracking state
        self.live_cap = None
        self.live_tracking_active = False
        self.frame_accumulator = []
        self.current_live_frame = None
        
        # Performance optimization
        self.frame_skip_counter = 0
        self.frame_skip_rate = 5  # Only process every 5th frame for live display
        
    def encode_frame_to_base64(self, frame):
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

    def make_vila_request(self, payload):
        """Make request to VILA API with error handling"""
        try:
            headers = {
                "Authorization": f"Bearer {self.NVIDIA_API_KEY}",
                "Content-Type": "application/json"
            }
            
            session = requests.Session()
            session.verify = False
            
            response = session.post(self.VILA_API_URL, headers=headers, json=payload, timeout=120)
            
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

    def extract_key_frames(self, cap, total_frames, num_frames=12):
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

    def create_output_video(self, cap, output_path, fps, w, h, video_type="analysis"):
        """Create output video with overlays"""
        try:
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(output_path, fourcc, fps, (w, h))
            
            frame_count = 0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            # Reset to start
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_count += 1
                timestamp = frame_count / fps if fps > 0 else 0

                if video_type == "anomaly":
                    cv2.putText(frame, f"ANOMALY SCAN - Time: {timestamp:.1f}s", 
                               (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                    cv2.putText(frame, "Scanning for anomalies...", 
                               (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                else:
                    cv2.putText(frame, f"ANALYZED - Time: {timestamp:.1f}s", 
                               (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                    cv2.putText(frame, "Content Analysis Complete", 
                               (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                out.write(frame)
                
                # Progress indicator
                if frame_count % (fps * 2) == 0:
                    progress = (frame_count / total_frames * 100) if total_frames > 0 else 0
                    print(f"Video processing progress: {progress:.1f}%")

            out.release()
            return True
            
        except Exception as e:
            print(f"Error creating output video: {e}")
            return False

    def analyze_video_with_vila(self, key_frames, video_duration):
        """Use VILA to analyze and summarize the entire video"""
        try:
            if len(key_frames) < 3:
                return "Insufficient frames for analysis"
            
            # Encode key frames to base64
            encoded_frames = []
            for frame in key_frames:
                encoded_frame = self.encode_frame_to_base64(frame)
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
5. Overall description of the scene and story.

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
            return self.make_vila_request(payload)
            
        except Exception as e:
            print(f"Error in VILA video analysis: {e}")
            return f"Analysis Error: {str(e)}"

    def detect_anomalies_with_vila(self, key_frames, video_duration):
        """Use VILA to detect anomalies and unusual events in the video"""
        try:
            if len(key_frames) < 3:
                return "Insufficient frames for anomaly detection"
            
            # Encode key frames to base64
            encoded_frames = []
            for frame in key_frames:
                encoded_frame = self.encode_frame_to_base64(frame)
                if encoded_frame:
                    encoded_frames.append(encoded_frame)
            
            if not encoded_frames:
                return "Error: Could not encode frames for anomaly detection"
            
            # Create specific prompt for anomaly detection
            prompt = f"""Analyze this sequence of {len(encoded_frames)} frames from a {video_duration:.1f}-second video and provide a SUMMARY of anomalies detected.

DETECT THESE ANOMALIES:
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
- Any disruption to normal operations

Provide a CONCISE SUMMARY describing:
1. What types of anomalies were observed
2. Brief description of each incident
3. Overall assessment of the scene

If NO anomalies detected, state: "No significant anomalies detected - normal activity observed."

Keep response brief and focused on WHAT happened."""

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
            
            print("Analyzing frames for anomalies with VILA...")
            return self.make_vila_request(payload)
            
        except Exception as e:
            print(f"Error in VILA anomaly detection: {e}")
            return f"Anomaly Detection Error: {str(e)}"

    def analyze_video(self, video_path):
        """Analyze uploaded video file"""
        try:
            cap = cv2.VideoCapture(video_path)
            
            if not cap.isOpened():
                raise Exception("Could not open video file")
            
            fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
            w = int(cap.get(3)) or 640
            h = int(cap.get(4)) or 480
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
            duration = total_frames / fps if fps > 0 and total_frames > 0 else 0

            print(f"Video info: {duration:.1f}s, {total_frames} frames, {fps} FPS, {w}x{h}")

            # Extract key frames for VILA analysis
            key_frames = self.extract_key_frames(cap, total_frames, num_frames=15)
            print(f"Extracted {len(key_frames)} key frames")

            if not key_frames:
                cap.release()
                raise Exception("Could not extract frames from video")

            # Create output video
            timestamp = int(time.time())
            output_filename = f"analyzed_{timestamp}.mp4"
            output_path = os.path.join('outputs', output_filename)
            os.makedirs('outputs', exist_ok=True)
            
            start_time = time.time()
            success = self.create_output_video(cap, output_path, fps, w, h, "analysis")
            cap.release()
            
            if not success:
                raise Exception("Could not create output video")

            # Analyze video with VILA
            vila_summary = self.analyze_video_with_vila(key_frames, duration)
            processing_time = time.time() - start_time

            # Build complete summary
            summary = "VIDEO ANALYSIS REPORT\n"
            summary += "=" * 50 + "\n\n"
            summary += f"Technical Details:\n"
            summary += f"• Duration: {duration:.2f} seconds\n"
            summary += f"• Total Frames: {total_frames}\n"
            summary += f"• Frame Rate: {fps} FPS\n"
            summary += f"• Resolution: {w}x{h}\n"
            summary += f"• Processing Time: {processing_time:.1f} seconds\n\n"
            
            summary += f"Video Content Analysis:\n"
            summary += "-" * 30 + "\n"
            summary += vila_summary + "\n\n"
            
            summary += f"Analysis Method:\n"
            summary += f"• Analyzed {len(key_frames)} key frames using VILA\n"
            summary += f"• AI Model: NVIDIA VILA (Vision-Language Assistant)\n"
            summary += f"• Frame sampling: Evenly distributed across video duration\n\n"

            return {
                'success': True,
                'summary': summary,
                'output_video': f'/api/video/{output_filename}',
                'key_frames': key_frames,
                'processing_time': processing_time
            }
            
        except Exception as e:
            print(f"Error in video analysis: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def detect_anomalies(self, video_path):
        """Detect anomalies in uploaded video file"""
        try:
            cap = cv2.VideoCapture(video_path)
            
            if not cap.isOpened():
                raise Exception("Could not open video file")
            
            fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
            w = int(cap.get(3)) or 640
            h = int(cap.get(4)) or 480
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
            duration = total_frames / fps if fps > 0 and total_frames > 0 else 0

            # Extract more key frames for better anomaly detection
            key_frames = self.extract_key_frames(cap, total_frames, num_frames=20)
            
            if not key_frames:
                cap.release()
                raise Exception("Could not extract frames from video")

            # Create output video with anomaly detection overlay
            timestamp = int(time.time())
            output_filename = f"anomaly_{timestamp}.mp4"
            output_path = os.path.join('outputs', output_filename)
            os.makedirs('outputs', exist_ok=True)
            
            start_time = time.time()
            success = self.create_output_video(cap, output_path, fps, w, h, "anomaly")
            cap.release()
            
            if not success:
                raise Exception("Could not create output video")

            # Detect anomalies with VILA
            anomaly_report = self.detect_anomalies_with_vila(key_frames, duration)
            processing_time = time.time() - start_time

            # Build anomaly report
            summary = "ANOMALY DETECTION SUMMARY\n"
            summary += "=" * 50 + "\n\n"
            summary += f"Video Details:\n"
            summary += f"• Duration: {duration:.2f} seconds ({total_frames} frames)\n"
            summary += f"• Resolution: {w}x{h} @ {fps} FPS\n"
            summary += f"• Frames Analyzed: {len(key_frames)} key frames\n\n"
            
            # Add common anomaly types reference
            summary += f"Anomaly Types Monitored:\n"
            common_anomalies = [
                "• Falling objects/people, equipment malfunctions",
                "• Spills, collisions, safety incidents", 
                "• Theft, loitering, unattended objects",
                "• Crowd formations, violence, intrusions",
                "• Suspicious movements, vandalism",
                "• Vehicle violations, trespassing"
            ]
            summary += "\n".join(common_anomalies) + "\n\n"
            
            summary += f"Analysis Summary:\n"
            summary += "-" * 30 + "\n"
            summary += anomaly_report + "\n\n"
            
            summary += f"Detection Method: NVIDIA VILA • Focus: Safety & Incident Detection\n"

            return {
                'success': True,
                'summary': summary,
                'output_video': f'/api/video/{output_filename}',
                'key_frames': key_frames,
                'processing_time': processing_time
            }
            
        except Exception as e:
            print(f"Error in anomaly detection: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    # Live monitoring methods with optimized performance
    def start_live_tracking(self):
        """Start live video tracking with camera"""
        try:
            # Try different camera indices
            camera_indices = [0, 1, 2]
            self.live_cap = None
            
            for idx in camera_indices:
                test_cap = cv2.VideoCapture(idx)
                if test_cap.isOpened():
                    ret, test_frame = test_cap.read()
                    if ret and test_frame is not None:
                        self.live_cap = test_cap
                        print(f"Successfully opened camera index {idx}")
                        break
                    else:
                        test_cap.release()
                else:
                    test_cap.release()
            
            if self.live_cap is None:
                return False, "Error: Could not access any camera. Please check camera permissions."
            
            # Configure camera for better performance
            self.live_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.live_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.live_cap.set(cv2.CAP_PROP_FPS, 30)
            self.live_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce buffer size for lower latency
            
            self.live_tracking_active = True
            self.frame_accumulator = []
            self.current_live_frame = None
            self.frame_skip_counter = 0
            
            return True, "Live tracking started successfully"
            
        except Exception as e:
            return False, f"Error starting live tracking: {str(e)}"

    def stop_live_tracking(self):
        """Stop live video tracking cleanly"""
        print("Stopping live video tracking...")
        self.live_tracking_active = False
        
        if self.live_cap is not None:
            self.live_cap.release()
            self.live_cap = None
            print("Camera released successfully")
        
        self.current_live_frame = None
        self.frame_accumulator = []
        self.frame_skip_counter = 0

    def get_current_frame(self):
        """Get current frame from live camera with optimized performance"""
        if not self.live_tracking_active or self.live_cap is None:
            return None
        
        try:
            ret, frame = self.live_cap.read()
            if ret and frame is not None:
                # Skip frames for performance (only process every 5th frame for accumulator)
                self.frame_skip_counter += 1
                
                if self.frame_skip_counter % self.frame_skip_rate == 0:
                    # Add frame to accumulator less frequently
                    self.frame_accumulator.append(frame.copy())
                    
                    # Keep accumulator manageable (last 10 seconds worth of sampled frames)
                    # At 30fps with skip rate 5, we get 6 frames per second
                    if len(self.frame_accumulator) > 60:  # 10 seconds * 6 frames/sec
                        self.frame_accumulator = self.frame_accumulator[-60:]
                
                # Always update display frame (but don't always accumulate)
                display_frame = frame.copy()
                cv2.putText(display_frame, f"LIVE - {datetime.now().strftime('%H:%M:%S')}", 
                           (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                cv2.putText(display_frame, f"Buffer: {len(self.frame_accumulator)}", 
                           (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
                
                self.current_live_frame = display_frame
                return display_frame
            
        except Exception as e:
            print(f"Error getting current frame: {e}")
        
        return None

    def analyze_live_feed(self):
        """Analyze current live feed with reduced frequency"""
        if not self.live_tracking_active or len(self.frame_accumulator) < 3:
            return "Live tracking not active or insufficient frames for analysis"
        
        try:
            # Take fewer frames for analysis to reduce API load
            # Use last 6 frames (approximately 1 second of sampled video)
            recent_frames = self.frame_accumulator[-6:] if len(self.frame_accumulator) >= 6 else self.frame_accumulator
            
            analysis_result = self.analyze_video_with_vila(recent_frames, len(recent_frames) / 6.0)
            
            return f"LIVE ANALYSIS [{datetime.now().strftime('%H:%M:%S')}]\n" + \
                   "=" * 40 + "\n" + \
                   f"Frames analyzed: {len(recent_frames)}\n" + \
                   f"Sample duration: ~{len(recent_frames)/6.0:.1f}s\n" + \
                   f"Camera: Live feed\n\n" + \
                   "Analysis:\n" + \
                   "-" * 20 + "\n" + \
                   analysis_result
            
        except Exception as e:
            return f"Error analyzing live feed: {str(e)}"

    def check_live_anomalies(self):
        """Check for anomalies in current live feed with reduced frequency"""
        if not self.live_tracking_active or len(self.frame_accumulator) < 3:
            return "Live tracking not active or insufficient frames for anomaly detection"
        
        try:
            # Take fewer frames for anomaly detection to reduce API load
            # Use last 9 frames (approximately 1.5 seconds of sampled video)
            recent_frames = self.frame_accumulator[-9:] if len(self.frame_accumulator) >= 9 else self.frame_accumulator
            
            anomaly_result = self.detect_anomalies_with_vila(recent_frames, len(recent_frames) / 6.0)
            
            return f"ANOMALY CHECK [{datetime.now().strftime('%H:%M:%S')}]\n" + \
                   "=" * 40 + "\n" + \
                   f"Frames analyzed: {len(recent_frames)}\n" + \
                   f"Sample duration: ~{len(recent_frames)/6.0:.1f}s\n" + \
                   f"Camera: Live feed\n\n" + \
                   "Anomaly Detection Results:\n" + \
                   "-" * 30 + "\n" + \
                   anomaly_result
            
        except Exception as e:
            return f"Error detecting anomalies in live feed: {str(e)}"

    def process_chat_question(self, question, video_context, context_source=None):
        """Process chat question with video context (supports both uploaded and live video)"""
        try:
            if not video_context:
                return "No video context available. Please analyze a video first."
            
            # Create context-aware prompt with source information
            context_type = "live video feed" if context_source == "live" else "uploaded video"
            
            context_prompt = f"""You are an AI assistant helping analyze a {context_type}. Here's what we know:

VIDEO ANALYSIS CONTEXT ({context_type.upper()}):
{video_context.get('summary', 'No summary available')}

USER QUESTION: {question}

Please answer the user's question based on the video analysis context provided. Be conversational and helpful. 

{"Since this is from a live feed, note that the analysis is based on recent frames and may represent just a snapshot of ongoing activity." if context_source == "live" else "This analysis is from the complete uploaded video."}

If the question asks about something not visible in the analyzed frames, let them know the limitation while providing what information you can from the analysis."""

            # Prepare payload for VILA (simplified for chat)
            payload = {
                "model": "nvidia/vila",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": context_prompt
                            }
                        ]
                    }
                ],
                "max_tokens": 400,
                "temperature": 0.5,
                "stream": False
            }
            
            print(f"Processing chat question: {question} (Context: {context_source or 'uploaded'})")
            response = self.make_vila_request(payload)
            
            return response
            
        except Exception as e:
            return f"Error processing your question: {str(e)}"