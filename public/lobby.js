// 🎪 LOBBY MANAGEMENT SYSTEM
class LobbyManager {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.onlineUsers = [];
        this.callState = 'idle'; // idle, requesting, ringing, in-call
        this.activeCall = null;
        
        this.setupDOM();
        this.setupEventListeners();
    }
    
    setupDOM() {
        // Create lobby container if it doesn't exist
        if (!document.getElementById('lobby-container')) {
            const lobbyHTML = `
                <div id="lobby-container" class="lobby-container">
                    <div class="lobby-header">
                        <h2>👥 Online Users</h2>
                        <div class="lobby-stats">
                            <span id="online-count">0 online</span>
                            <button id="refresh-users" class="btn-small">🔄</button>
                        </div>
                    </div>
                    
                    <div class="users-list" id="users-list">
                        <div class="empty-state">
                            <p>No users online yet...</p>
                        </div>
                    </div>
                    
                    <div class="call-controls" id="call-controls" style="display: none;">
                        <div class="call-info">
                            <h3>📞 Active Call</h3>
                            <p id="call-with">Calling...</p>
                        </div>
                        <div class="call-buttons">
                            <button id="end-call-btn" class="btn-danger">❌ End Call</button>
                            <button id="mute-audio-btn" class="btn-secondary">🔇 Mute</button>
                            <button id="hide-video-btn" class="btn-secondary">👁️ Hide Video</button>
                        </div>
                    </div>
                    
                    <div class="incoming-call" id="incoming-call-container" style="display: none;">
                        <div class="call-alert">
                            <h3>📞 Incoming Call!</h3>
                            <p id="caller-name">Someone is calling...</p>
                            <div class="call-alert-buttons">
                                <button id="accept-call-btn" class="btn-success">✅ Accept</button>
                                <button id="reject-call-btn" class="btn-danger">❌ Reject</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Insert lobby into chat container
            const chatContainer = document.getElementById('chat-container');
            if (chatContainer) {
                const videoBox = document.querySelector('.video-box');
                chatContainer.insertBefore(this.createElementFromHTML(lobbyHTML), videoBox);
            }
        }
    }
    
    createElementFromHTML(htmlString) {
        const div = document.createElement('div');
        div.innerHTML = htmlString.trim();
        return div.firstChild;
    }
    
    setupEventListeners() {
        // Socket event listeners will be set when socket connects
    }
    
    // Called after user logs in
    initialize(user) {
        this.currentUser = user;
        console.log("🎪 Initializing lobby for:", user.displayName);
        
        // Connect to socket server
        this.connectToServer();
        
        // Setup UI listeners
        this.setupUIListeners();
    }
    
    connectToServer() {
        this.socket = io();
        
        // Socket event listeners
        this.socket.on('connect', () => {
            console.log("🔌 Connected to lobby server");
            
            // Join lobby with user info
            this.socket.emit('join-lobby', {
                userId: this.currentUser.uid,
                userName: this.currentUser.displayName || this.currentUser.email
            });
        });
        
        this.socket.on('lobby-welcome', (data) => {
            console.log("🎪 Welcome to lobby:", data.message);
            this.updateUsersList(data.users);
        });
        
        this.socket.on('users-update', (users) => {
            this.updateUsersList(users);
        });
        
        this.socket.on('incoming-call', (data) => {
            this.handleIncomingCall(data);
        });
        
        this.socket.on('call-request-sent', (data) => {
            console.log("📞 Call request sent to:", data.toUserId);
            this.showCallStatus('Request sent...');
        });
        
        this.socket.on('call-started', (data) => {
            this.handleCallStarted(data);
        });
        
        this.socket.on('call-rejected', (data) => {
            alert(`❌ Call rejected: ${data.message}`);
            this.resetCallState();
        });
        
        this.socket.on('call-ended', (data) => {
            alert(`📞 Call ended: ${data.message}`);
            this.resetCallState();
        });
        
        this.socket.on('webrtc-signal', (data) => {
            // Forward to video chat system
            if (window.videoChat) {
                window.videoChat.handleWebRTCSignal(data);
            }
        });
        
        this.socket.on('call-error', (data) => {
            alert(`❌ Call error: ${data.message}`);
            this.resetCallState();
        });
    }
    
    setupUIListeners() {
        // Refresh users list
        document.getElementById('refresh-users')?.addEventListener('click', () => {
            this.socket.emit('request-users-update');
        });
        
        // Call control buttons
        document.getElementById('end-call-btn')?.addEventListener('click', () => {
            this.endCurrentCall();
        });
        
        document.getElementById('accept-call-btn')?.addEventListener('click', () => {
            this.acceptIncomingCall();
        });
        
        document.getElementById('reject-call-btn')?.addEventListener('click', () => {
            this.rejectIncomingCall();
        });
    }
    
    updateUsersList(users) {
        const usersList = document.getElementById('users-list');
        const onlineCount = document.getElementById('online-count');
        
        if (!usersList) return;
        
        // Filter out current user
        const otherUsers = users.filter(user => 
            user.userId !== this.currentUser.uid
        );
        
        // Update count
        if (onlineCount) {
            onlineCount.textContent = `${otherUsers.length} online`;
        }
        
        // Clear current list
        usersList.innerHTML = '';
        
        if (otherUsers.length === 0) {
            usersList.innerHTML = `
                <div class="empty-state">
                    <p>No other users online yet...</p>
                    <p class="hint">Open another browser to test!</p>
                </div>
            `;
            return;
        }
        
        // Add each user to the list
        otherUsers.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = `user-item ${user.status}`;
            userElement.dataset.userId = user.userId;
            userElement.dataset.userName = user.userName;
            
            const statusIcon = this.getStatusIcon(user.status);
            const canCall = user.status === 'online';
            
            userElement.innerHTML = `
                <div class="user-info">
                    <span class="user-avatar">${user.userName.charAt(0)}</span>
                    <div class="user-details">
                        <span class="user-name">${user.userName}</span>
                        <span class="user-status ${user.status}">${statusIcon} ${user.status}</span>
                    </div>
                </div>
                <button class="call-btn ${canCall ? '' : 'disabled'}" 
                        ${canCall ? '' : 'disabled'}
                        onclick="window.lobbyManager.requestCall('${user.userId}', '${user.userName}')">
                    📞 Call
                </button>
            `;
            
            usersList.appendChild(userElement);
        });
        
        this.onlineUsers = otherUsers;
    }
    
    getStatusIcon(status) {
        switch(status) {
            case 'online': return '🟢';
            case 'busy': return '🟡';
            case 'in-call': return '🔴';
            case 'away': return '⚪';
            default: return '⚪';
        }
    }
    
    requestCall(toUserId, toUserName) {
        if (this.callState !== 'idle') {
            alert("You're already in a call!");
            return;
        }
        
        if (!confirm(`Call ${toUserName}?`)) {
            return;
        }
        
        this.callState = 'requesting';
        this.activeCall = {
            toUserId: toUserId,
            toUserName: toUserName,
            callId: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        };
        
        // Send call request
        this.socket.emit('request-call', {
            toUserId: toUserId,
            fromUserId: this.currentUser.uid,
            fromUserName: this.currentUser.displayName || this.currentUser.email,
            callId: this.activeCall.callId
        });
        
        this.showCallStatus(`Calling ${toUserName}...`);
    }
    
    handleIncomingCall(data) {
        this.callState = 'ringing';
        this.activeCall = {
            fromUserId: data.fromUserId,
            fromUserName: data.fromUserName,
            callId: data.callId
        };
        
        // Show incoming call UI
        const container = document.getElementById('incoming-call-container');
        const callerName = document.getElementById('caller-name');
        
        if (container && callerName) {
            callerName.textContent = `${data.fromUserName} is calling...`;
            container.style.display = 'block';
            
            // Auto-hide after 30 seconds if not answered
            setTimeout(() => {
                if (this.callState === 'ringing') {
                    this.rejectIncomingCall();
                }
            }, 30000);
        }
        
        // Play ringtone
        this.playRingtone();
    }
    
    acceptIncomingCall() {
        if (!this.activeCall) return;
        
        this.stopRingtone();
        this.callState = 'in-call';
        
        // Hide incoming call UI
        document.getElementById('incoming-call-container').style.display = 'none';
        
        // Send acceptance to server
        this.socket.emit('accept-call', {
            callId: this.activeCall.callId,
            fromUserId: this.activeCall.fromUserId,
            toUserId: this.currentUser.uid
        });
        
        // Show call controls
        document.getElementById('call-controls').style.display = 'block';
        document.getElementById('call-with').textContent = 
            `In call with ${this.activeCall.fromUserName}`;
    }
    
    rejectIncomingCall() {
        if (!this.activeCall) return;
        
        this.stopRingtone();
        
        this.socket.emit('reject-call', {
            callId: this.activeCall.callId,
            fromUserId: this.activeCall.fromUserId
        });
        
        this.resetCallState();
        document.getElementById('incoming-call-container').style.display = 'none';
    }
    
    handleCallStarted(data) {
        this.callState = 'in-call';
        this.activeCall.roomId = data.roomId;
        
        // Show call controls
        document.getElementById('call-controls').style.display = 'block';
        
        // Find the other user's name
        const otherUser = data.users.find(user => 
            user.userId !== this.currentUser.uid
        );
        
        if (otherUser) {
            document.getElementById('call-with').textContent = 
                `In call with ${otherUser.userName}`;
        }
        
        // Initialize video chat
        if (window.videoChat) {
            window.videoChat.startCallWithUser(otherUser);
        }
    }
    
    endCurrentCall() {
        if (!this.activeCall) return;
        
        this.socket.emit('end-call', {
            callId: this.activeCall.callId
        });
        
        if (window.videoChat) {
            window.videoChat.stopMyCamera();
        }
        
        this.resetCallState();
    }
    
    resetCallState() {
        this.callState = 'idle';
        this.activeCall = null;
        
        // Hide all call UIs
        document.getElementById('call-controls').style.display = 'none';
        document.getElementById('incoming-call-container').style.display = 'none';
    }
    
    showCallStatus(message) {
        // Could show a toast notification
        console.log("📞 Status:", message);
    }
    
    playRingtone() {
        // Simple ringtone using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            
            // Repeat every second
            this.ringtoneInterval = setInterval(() => {
                const repeatOsc = audioContext.createOscillator();
                const repeatGain = audioContext.createGain();
                
                repeatOsc.connect(repeatGain);
                repeatGain.connect(audioContext.destination);
                
                repeatOsc.frequency.value = 800;
                repeatOsc.type = 'sine';
                
                repeatGain.gain.setValueAtTime(0.3, audioContext.currentTime);
                repeatGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                repeatOsc.start(audioContext.currentTime);
                repeatOsc.stop(audioContext.currentTime + 0.5);
            }, 1000);
            
        } catch (error) {
            console.log("Could not play ringtone:", error);
        }
    }
    
    stopRingtone() {
        if (this.ringtoneInterval) {
            clearInterval(this.ringtoneInterval);
            this.ringtoneInterval = null;
        }
    }
    
    // Cleanup when user logs out
    cleanup() {
        if (this.socket) {
            this.socket.emit('leave-lobby');
            this.socket.disconnect();
        }
        this.stopRingtone();
        this.resetCallState();
    }
}

// Initialize lobby manager
window.addEventListener('load', () => {
    window.lobbyManager = new LobbyManager();
});