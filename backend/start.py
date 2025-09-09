import subprocess
import sys
import time
import os
import atexit

# Global variables to track processes
api_process = None
flask_process = None

def cleanup():
    """Clean up processes on exit"""
    global api_process, flask_process
    print("\nCleaning up processes...")
    
    if api_process:
        api_process.terminate()
        print("FastAPI server stopped")
    
    if flask_process:
        flask_process.terminate()
        print("Flask app stopped")

def main():
    global api_process, flask_process
    
    print("Starting Video Analysis Platform...")
    
    # Register cleanup function
    atexit.register(cleanup)
    
    # Find api_server.py
    current_dir = os.path.dirname(os.path.abspath(__file__))
    api_server_path = os.path.join(current_dir, 'backend', 'api_server.py')
    
    if not os.path.exists(api_server_path):
        api_server_path = os.path.join(current_dir, 'api_server.py')
    
    if not os.path.exists(api_server_path):
        print("❌ api_server.py not found in current directory or backend folder!")
        return
    
    # Start FastAPI server
    print("🚀 Starting FastAPI server (port 8000)...")
    try:
        api_process = subprocess.Popen([sys.executable, api_server_path])
        time.sleep(4)  # Give FastAPI time to start
        print("✅ FastAPI server started")
    except Exception as e:
        print(f"❌ Failed to start FastAPI server: {e}")
        return
    
    # Start Flask app
    print("🚀 Starting Flask app (port 5000)...")
    try:
        flask_process = subprocess.Popen([sys.executable, 'app.py'])
        time.sleep(2)  # Give Flask time to start
        print("✅ Flask app started")
    except Exception as e:
        print(f"❌ Failed to start Flask app: {e}")
        if api_process:
            api_process.terminate()
        return
    
    print("\n" + "="*50)
    print("🎉 VIDEO ANALYSIS PLATFORM READY!")
    print("="*50)
    print("📱 Main App: http://localhost:5000")
    print("🔌 API Server: http://localhost:8000")
    print("📹 Video Analysis: http://localhost:5000/analyzer.html")
    print("\nPress Ctrl+C to stop all servers")
    print("="*50)
    
    try:
        # Keep the script running and monitor processes
        while True:
            # Check if processes are still running
            if api_process.poll() is not None:
                print("⚠️  FastAPI server stopped unexpectedly")
                break
            
            if flask_process.poll() is not None:
                print("⚠️  Flask app stopped unexpectedly")
                break
            
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Shutdown requested by user")
    
    cleanup()

if __name__ == '__main__':
    main()