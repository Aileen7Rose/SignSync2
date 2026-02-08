// This file reads hand signs!
class SignLanguageDetector {
    constructor() {
        this.detectBtn = document.getElementById('detect-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.speakBtn = document.getElementById('speak-btn');
        this.textOutput = document.getElementById('text-output');
        
        this.hands = null;
        this.camera = null;
        this.isDetecting = false;
        this.currentText = '';
        
        this.setup();
    }
    
    setup() {
        // When buttons are clicked
        this.detectBtn.onclick = () => this.startDetection();
        this.resetBtn.onclick = () => this.resetText();
        this.speakBtn.onclick = () => this.speakText();
        
        console.log('✋ Hand detector ready! Click "Start Sign Detection"');
    }
    
    async startDetection() {
        if (this.isDetecting) {
            this.stopDetection();
            return;
        }
        
        console.log('🚀 Starting sign language detection...');
        this.isDetecting = true;
        this.detectBtn.textContent = '🛑 Stop Detection';
        this.detectBtn.style.background = '#f44336';
        
        // Load the hand-reading magic
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        // When hands are found
        this.hands.onResults((results) => {
            this.processHands(results);
        });
        
        // Start the camera
        const videoElement = document.getElementById('local-video');
        this.camera = new Camera(videoElement, {
            onFrame: async () => {
                await this.hands.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });
        
        this.camera.start();
        console.log('✅ Detection started! Show your hands to the camera!');
    }
    
    processHands(results) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            return; // No hands found
        }
        
        // Get the first hand we see
        const landmarks = results.multiHandLandmarks[0];
        
        // Check what sign is being shown
        const sign = this.recognizeSign(landmarks);
        
        if (sign) {
            this.addText(sign);
        }
    }
    
    recognizeSign(landmarks) {
        // Get finger tips (like getting finger positions)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        const wrist = landmarks[0];
        
        // Check if hand is open (fingers far from wrist)
        const distances = [
            this.getDistance(thumbTip, wrist),
            this.getDistance(indexTip, wrist),
            this.getDistance(middleTip, wrist),
            this.getDistance(ringTip, wrist),
            this.getDistance(pinkyTip, wrist)
        ];
        
        const averageDistance = distances.reduce((a, b) => a + b) / distances.length;
        
        // Simple sign recognition
        if (averageDistance > 0.25) {
            return "HELLO";
        } else if (averageDistance < 0.15) {
            return "YES";
        }
        
        // Check for thumbs up
        if (thumbTip.y < wrist.y - 0.1) {
            return "GOOD";
        }
        
        return null;
    }
    
    getDistance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    addText(word) {
        // Don't add the same word too quickly
        if (this.currentText.endsWith(word)) {
            return;
        }
        
        this.currentText += word + ' ';
        this.textOutput.textContent = this.currentText;
        
        console.log('📝 Detected:', word);
    }
    
    resetText() {
        this.currentText = '';
        this.textOutput.textContent = 'Your sign language will appear here as text...';
        console.log('🔄 Text cleared!');
    }
    
    speakText() {
        if (!this.currentText.trim()) {
            alert('🤔 No text to speak! Make some signs first.');
            return;
        }
        
        if ('speechSynthesis' in window) {
            const speech = new SpeechSynthesisUtterance(this.currentText);
            speech.rate = 1.0;
            speech.pitch = 1.0;
            speech.volume = 1.0;
            
            window.speechSynthesis.speak(speech);
            console.log('🔊 Speaking:', this.currentText);
        } else {
            alert('❌ Your browser cannot speak text. Try Chrome or Edge.');
        }
    }
    
    stopDetection() {
        if (this.camera) {
            this.camera.stop();
        }
        this.isDetecting = false;
        this.detectBtn.textContent = '✋ Start Sign Detection';
        this.detectBtn.style.background = '#2196F3';
        console.log('🛑 Detection stopped');
    }
}

// Start hand detection when page is ready
window.addEventListener('load', () => {
    window.signDetector = new SignLanguageDetector();
});