// 🎥 Video Chat with Lobby System Integration
// This works AFTER users connect through the lobby

class VideoChat {
    constructor() {
        // Video elements
        this.myVideo = document.getElementById('local-video');
        this.friendVideo = document.getElementById('remote-video');
        this.remoteUserName = document.getElementById('remote-user-name');
        
        // Buttons
        this.startBtn = document.getElementById('start-btn');
        this.detectBtn = document.getElementById('detect-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.speakBtn = document.getElementById('speak-btn');
        this.logoutBtn = document.getElementById('logout-btn');
        
        // Call control buttons (from lobby)
        this.endCallBtn = document.getElementById('end-call-btn');
        this.muteAudioBtn = document.getElementById('mute-audio-btn');
        this.hideVideoBtn = document.getElementById('hide-video-btn');
        
        // Status display
        this.status = document.getElementById('status');
        
        // User info
        this.currentUser = null;
        this.peerConnection = null;
        this.myStream = null;
        this.friendInfo = null;
        
        // Media state
        this.isAudioMuted = false;
        this.isVideoHidden = false;
        
        // Stats
        this.connectionStartTime = null;
        this.callDurationInterval = null;
        
        // Start setup (but wait for login)
        this.prepareElements();
        console.log("🎮 Video Chat initialized - waiting for login...");
    }
    
    prepareElements() {
        // Initially disable chat buttons until login
        if (this.startBtn) this.startBtn.disabled = true;
        if (this.detectBtn) this.detectBtn.disabled = true;
        
        // Set initial status
        this.updateStatus("🔐 Please login to start video chat");
        
        // Setup button listeners that don't require login
        this.setupBasicListeners();
    }
    
    setupBasicListeners() {
        // Reset text button
        if (this.resetBtn) {
            this.resetBtn.onclick = () => {
                if (window.signDetector) {
                    window.signDetector.resetText();
                }
                this.updateStatus("🔄 Text cleared");
            };
        }
        
        // Speak text button
        if (this.speakBtn) {
            this.speakBtn.onclick = () => {
                if (window.signDetector) {
                    window.signDetector.speakText();
                }
            };
        }
        
        // Call control buttons (will be enabled during call)
        if (this.endCallBtn) {
            this.endCallBtn.onclick = () => this.endCurrentCall();
        }
        
        if (this.muteAudioBtn) {
            this.muteAudioBtn.onclick = () => this.toggleAudioMute();
        }
        
        if (this.hideVideoBtn) {
            this.hideVideoBtn.onclick = () => this.toggleVideoHide();
        }
    }
    
    // 🚀 Called after user logs in
    setupAfterLogin(user) {
        console.log("👤 Setting up video chat for:", user.displayName || user.email);
        
        this.currentUser = user;
        this.userId = user.uid;
        this.userName = user.displayName || user.email.split('@')[0];
        
        // Update UI
        this.updateStatus(`✅ Welcome ${this.userName}! Click "Start Camera" to begin.`);
        
        // Enable camera button
        if (this.startBtn) {
            this.startBtn.disabled = false;
            this.startBtn.onclick = () => {
                if (!this.myStream) {
                    this.startMyCamera();
                } else {
                    this.stopMyCamera();
                }
            };
        }
        
        // Enable sign detection button (only when camera is on)
        if (this.detectBtn) {
            this.detectBtn.disabled = true;
            this.detectBtn.onclick = () => {
                if (window.signDetector) {
                    if (window.signDetector.isDetecting) {
                        window.signDetector.stopDetection();
                        this.detectBtn.textContent = '✋ Start Sign Detection';
                        this.detectBtn.style.background = '#2196F3';
                    } else {
                        window.signDetector.startDetection();
                        this.detectBtn.textContent = '🛑 Stop Detection';
                        this.detectBtn.style.background = '#f44336';
                    }
                }
            };
        }
        
        console.log("✅ Video Chat ready! Camera can be started.");
    }
    
    // 📷 Start/Stop Camera (called manually by user)
    async startMyCamera() {
        try {
            this.updateStatus("📷 Turning on camera...");
            
            // Ask for camera and microphone permission
            this.myStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                },
                audio: true
            });
            
            // Show my camera on screen
            this.myVideo.srcObject = this.myStream;
            
            // Update button
            this.startBtn.textContent = '🛑 Stop Camera';
            this.startBtn.style.background = '#f44336';
            this.startBtn.disabled = false;
            
            // Enable sign detection button
            if (this.detectBtn) this.detectBtn.disabled = false;
            
            this.updateStatus("✅ Camera ready! Go to lobby to find users to call.");
            
        } catch (error) {
            console.error("❌ Camera error:", error);
            
            let errorMessage = "Camera error: ";
            if (error.name === 'NotAllowedError') {
                errorMessage = "🔒 Camera access denied. Please allow camera access in browser settings.";
            } else if (error.name === 'NotFoundError') {
                errorMessage = "📹 No camera found. Please connect a camera.";
            } else if (error.name === 'NotReadableError') {
                errorMessage = "⚠️ Camera is being used by another application.";
            } else {
                errorMessage += error.message;
            }
            
            this.updateStatus(`❌ ${errorMessage}`);
        }
    }
    
    stopMyCamera() {
        if (this.myStream) {
            // Stop all tracks
            this.myStream.getTracks().forEach(track => {
                track.stop();
            });
            
            this.myStream = null;
            this.myVideo.srcObject = null;
            
            // Update button
            this.startBtn.textContent = '🎥 Start Camera';
            this.startBtn.style.background = '#4CAF50';
            
            // Disable sign detection
            if (this.detectBtn) {
                this.detectBtn.disabled = true;
                this.detectBtn.textContent = '✋ Start Sign Detection';
                this.detectBtn.style.background = '#2196F3';
                
                // Stop detection if active
                if (window.signDetector && window.signDetector.isDetecting) {
                    window.signDetector.stopDetection();
                }
            }
            
            // If in a call, end it
            if (this.peerConnection) {
                this.endCurrentCall();
            }
            
            this.updateStatus("🛑 Camera stopped. Click Start Camera to begin again.");
            this.remoteUserName.textContent = "Waiting for connection...";
            this.friendVideo.srcObject = null;
        }
    }
    
    // 📞 Called from Lobby when a call is accepted
    startCallWithUser(otherUser) {
        console.log("🎬 Starting call with:", otherUser.userName);
        
        if (!this.myStream) {
            alert("⚠️ Please start your camera first!");
            return;
        }
        
        this.friendInfo = {
            userId: otherUser.userId,
            userName: otherUser.userName
        };
        
        // Update remote user name display
        if (this.remoteUserName) {
            this.remoteUserName.textContent = otherUser.userName;
        }
        
        this.updateStatus(`📞 Connecting to ${otherUser.userName}...`);
        this.connectionStartTime = Date.now();
        
        // Start WebRTC connection
        this.initiateWebRTCConnection(otherUser.userId);
        
        // Start call duration timer
        this.startCallTimer();
    }
    
    initiateWebRTCConnection(toUserId) {
      console.log("🔗 INITIATING WebRTC with:", toUserId);
      
      // Close existing connection
      if (this.peerConnection) {
          this.peerConnection.close();
          this.peerConnection = null;
      }
      
      // SIMPLE & RELIABLE Configuration
      // Replace your configuration in initiateWebRTCConnection and handleIncomingOffer with:

      const configuration = {
          iceServers: [
              // STUN servers (simple format, no transport parameter)
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }, // Removed ?transport=udp
              { urls: 'stun:stun.1.google.com:19302' },
              
              // Additional reliable STUN servers
              { urls: 'stun:stun.relay.metered.ca:80' },
              { urls: 'stun:stun.nextcloud.com:443' },
              
              // TURN servers for NAT traversal (important!)
              { 
                  urls: 'turn:relay.metered.ca:80',
                  username: 'public',
                  credential: 'public' 
              },
              { 
                  urls: 'turn:relay.metered.ca:443',
                  username: 'public',
                  credential: 'public' 
              },
              { 
                  urls: 'turn:relay.metered.ca:443?transport=tcp',
                  username: 'public',
                  credential: 'public' 
              }
          ],
          iceCandidatePoolSize: 10,
          iceTransportPolicy: 'all' // Try both relay and host candidates
      };
      
      console.log("🎯 Creating RTCPeerConnection with config:", configuration);
      this.peerConnection = new RTCPeerConnection(configuration);
      this.peerConnection.onnegotiationneeded = () => {
    console.log("🤝 Negotiation needed!");
};

      // 🔍 EXTENSIVE DEBUG LOGGING
      this.peerConnection.oniceconnectionstatechange = () => {
          const state = this.peerConnection.iceConnectionState;
          console.log("❄️ ICE Connection State Changed:", state);
          this.updateStatus(`ICE: ${state}`);
          
          if (state === 'connected' || state === 'completed') {
              console.log("🎉 ICE CONNECTED SUCCESSFULLY!");
          } else if (state === 'failed') {
              console.error("❌ ICE FAILED - trying to recover...");
              this.peerConnection.restartIce();
          }
      };
      
      this.peerConnection.onconnectionstatechange = () => {
          const state = this.peerConnection.connectionState;
          console.log("🔗 Connection State Changed:", state);
          this.updateStatus(`Connection: ${state}`);
      };
      
      this.peerConnection.onsignalingstatechange = () => {
          console.log("📡 Signaling State:", this.peerConnection.signalingState);
      };
      
      // Add local tracks
      if (!this.myStream) {
          console.error("❌ No local stream available!");
          this.updateStatus("Error: No camera stream");
          return;
      }
      
      console.log("➕ Adding local tracks...");
      this.myStream.getTracks().forEach(track => {
          console.log(`  - Adding ${track.kind} track`);
          this.peerConnection.addTrack(track, this.myStream);
      });
      
      // Handle incoming remote tracks
      // Replace the current ontrack handler with this:
this.peerConnection.ontrack = (event) => {
      console.log("🎬 Received friend's stream:", event.streams[0]);
      console.log("Track received:", event.track.kind);
      
      if (event.streams && event.streams[0]) {
          // Check if we already have this stream
          if (this.friendVideo.srcObject !== event.streams[0]) {
              this.friendVideo.srcObject = event.streams[0];
              console.log("✅ Remote video stream set");
              
              // Ensure video plays
              this.friendVideo.play().catch(e => {
                  console.warn("⚠️ Auto-play prevented:", e);
                  this.friendVideo.muted = true;
                  this.friendVideo.play();
              });
          }
      } else {
          // Fallback for older browsers
          if (!this.remoteStream) {
              this.remoteStream = new MediaStream();
          }
          this.remoteStream.addTrack(event.track);
          this.friendVideo.srcObject = this.remoteStream;
      }
      
      // Calculate connection time
      const connectionTime = Date.now() - this.connectionStartTime;
      this.updateStatus(`✅ Connected to ${this.friendInfo.userName}! (${connectionTime}ms)`);
      
      // Enable call controls
      this.enableCallControls(true);
  };
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
              console.log("📤 ICE Candidate Found:", event.candidate.type);
              
              // Send through lobby
              if (window.lobbyManager && window.lobbyManager.socket && window.lobbyManager.socket.connected) {
                  window.lobbyManager.socket.emit('webrtc-signal', {
                      toUserId: toUserId,
                      signal: { candidate: event.candidate },
                      callId: window.lobbyManager.activeCall?.callId
                  });
              }
          } else {
              console.log("✅ All ICE candidates gathered");
          }
      };
      
      this.peerConnection.onicecandidateerror = (event) => {
          console.error("❄️ ICE Candidate Error:", event);
      };
      
      // Create offer
      console.log("📤 Creating offer...");
      this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
      })
      .then(offer => {
          console.log("📤 Offer created:", offer.type);
          return this.peerConnection.setLocalDescription(offer);
      })
      .then(() => {
          console.log("📤 Local description set, sending offer...");
           // Verify we have SDP to send
          if (!this.peerConnection.localDescription) {
              console.error("❌ No local description!");
              return;
          }
          // Send offer through lobby
          if (window.lobbyManager && window.lobbyManager.socket && window.lobbyManager.socket.connected) {
              window.lobbyManager.socket.emit('webrtc-signal', {
                  toUserId: toUserId,
                  signal: { sdp: this.peerConnection.localDescription,
                    type: 'offer'
                  },
                  
                  callId: window.lobbyManager.activeCall?.callId
              });
              console.log("✅ Offer sent via socket");
          } else {
              console.error("❌ Cannot send offer: Socket not connected");
          }
      })
      .catch(error => {
          console.error("❌ Error creating/sending offer:", error);
      });
  }
      
    
    // 📡 Handle WebRTC signals from lobby
    handleWebRTCSignal(data) {
      console.log("📡 handleWebRTCSignal called with:", data);
      console.log("  - Signal type:", data.signal.sdp ? 'SDP' : 'ICE');
      console.log("  - From user:", data.fromUserId);
      
      // If this is an offer and we don't have a connection yet
      if (data.signal.sdp && data.signal.sdp.type === 'offer' && !this.peerConnection) {
          console.log("📞 Incoming offer, creating answer...");
          this.handleIncomingOffer(data);
          return;
      }
      
      // If we have a peer connection, process the signal
      if (this.peerConnection) {
          if (data.signal.sdp) {
              console.log("📥 Setting remote description:", data.signal.sdp.type);
              this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.sdp))
                  .then(() => {
                      console.log("✅ Remote description set successfully");
                      
                      // If this is an offer, create an answer
                      if (data.signal.sdp.type === 'offer') {
                          console.log("📤 Creating answer...");
                          return this.peerConnection.createAnswer();
                      }
                  })
                  .then(answer => {
                      if (answer) {
                          console.log("📤 Answer created, setting local description");
                          return this.peerConnection.setLocalDescription(answer);
                      }
                  })
                  .then(() => {
                      if (data.signal.sdp.type === 'offer' && window.lobbyManager) {
                          // Send answer back
                          console.log("📤 Sending answer back...");
                          window.lobbyManager.socket.emit('webrtc-signal', {
                              toUserId: data.fromUserId,
                              signal: { sdp: this.peerConnection.localDescription },
                              callId: window.lobbyManager.activeCall?.callId
                          });
                      }
                  })
                  .catch(error => {
                      console.error("❌ Error processing SDP:", error);
                  });
          } else if (data.signal.candidate) {
              console.log("📥 Adding ICE candidate");
              this.peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate))
                  .then(() => {
                      console.log("✅ ICE candidate added");
                  })
                  .catch(error => {
                      console.error("❌ Error adding ICE candidate:", error);
                  });
          }
      } else {
          console.warn("⚠️ Received signal but no peer connection exists");
      }
  }
    
    handleIncomingOffer(data) {
        if (!this.myStream) {
            console.log("⚠️ No local stream for incoming call");
            return;
        }
        
        // Set friend info if not set
        if (!this.friendInfo) {
            this.friendInfo = {
                userId: data.fromUserId,
                userName: "Friend" // We'll update this when we get more info
            };
        }
        
        // Create peer connection for incoming call
        // Replace your configuration in initiateWebRTCConnection and handleIncomingOffer with:

          const configuration = {
              iceServers: [
                  // STUN servers (simple format, no transport parameter)
                  { urls: 'stun:stun.l.google.com:19302' },
                  { urls: 'stun:global.stun.twilio.com:3478' }, // Removed ?transport=udp
                  { urls: 'stun:stun.1.google.com:19302' },
                  
                  // Additional reliable STUN servers
                  { urls: 'stun:stun.relay.metered.ca:80' },
                  { urls: 'stun:stun.nextcloud.com:443' },
                  
                  // TURN servers for NAT traversal (important!)
                  { 
                      urls: 'turn:relay.metered.ca:80',
                      username: 'public',
                      credential: 'public' 
                  },
                  { 
                      urls: 'turn:relay.metered.ca:443',
                      username: 'public',
                      credential: 'public' 
                  },
                  { 
                      urls: 'turn:relay.metered.ca:443?transport=tcp',
                      username: 'public',
                      credential: 'public' 
                  }
              ],
              iceCandidatePoolSize: 10,
              iceTransportPolicy: 'all' // Try both relay and host candidates
          };
        
        this.peerConnection = new RTCPeerConnection(configuration);
        
        // Add our stream
        this.myStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.myStream);
        });
        
        // Set up event handlers (same as in initiateWebRTCConnection)
        this.peerConnection.ontrack = (event) => {
            this.friendVideo.srcObject = event.streams[0];
            this.updateStatus(`✅ Connected!`);
            this.enableCallControls(true);
        };
        
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && window.lobbyManager) {
                window.lobbyManager.socket.emit('webrtc-signal', {
                    toUserId: data.fromUserId,
                    signal: { candidate: event.candidate },
                    callId: window.lobbyManager.activeCall?.callId
                });
            }
        };
        
        // Handle the incoming offer
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.sdp))
            .then(() => {
                // Create and send answer
                return this.peerConnection.createAnswer();
            })
            .then(answer => {
                return this.peerConnection.setLocalDescription(answer);
            })
            .then(() => {
                // Send answer back
                if (window.lobbyManager && window.lobbyManager.socket) {
                    window.lobbyManager.socket.emit('webrtc-signal', {
                        toUserId: data.fromUserId,
                        signal: { sdp: this.peerConnection.localDescription },
                        callId: window.lobbyManager.activeCall?.callId
                    });
                }
            })
            .catch(error => {
                console.error("❌ Error handling incoming offer:", error);
            });
    }
    
    handleRemoteDescription(sdp) {
        if (!this.peerConnection) return;
        
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
            .catch(error => {
                console.error("❌ Error setting remote description:", error);
            });
    }
    
    handleIceCandidate(candidate) {
        if (!this.peerConnection) return;
        
        this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => {
                console.error("❌ Error adding ICE candidate:", error);
            });
    }
    
    // 🎛️ Call Controls
    endCurrentCall() {
        console.log("📞 Ending current call...");
        
        // Notify lobby manager
        if (window.lobbyManager && window.lobbyManager.activeCall) {
            window.lobbyManager.endCurrentCall();
        }
        
        // Close WebRTC connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Clear remote video
        this.friendVideo.srcObject = null;
        this.remoteUserName.textContent = "Call ended";
        
        // Disable call controls
        this.enableCallControls(false);
        
        // Stop call timer
        this.stopCallTimer();
        
        this.updateStatus("📞 Call ended. Back to lobby.");
        this.friendInfo = null;
    }
    
    toggleAudioMute() {
        if (!this.myStream) return;
        
        const audioTrack = this.myStream.getAudioTracks()[0];
        if (audioTrack) {
            this.isAudioMuted = !this.isAudioMuted;
            audioTrack.enabled = !this.isAudioMuted;
            
            if (this.muteAudioBtn) {
                this.muteAudioBtn.textContent = this.isAudioMuted ? '🔈 Unmute' : '🔇 Mute';
            }
            
            this.updateStatus(this.isAudioMuted ? "🔇 Audio muted" : "🔊 Audio unmuted");
        }
    }
    
    toggleVideoHide() {
        if (!this.myStream) return;
        
        const videoTrack = this.myStream.getVideoTracks()[0];
        if (videoTrack) {
            this.isVideoHidden = !this.isVideoHidden;
            videoTrack.enabled = !this.isVideoHidden;
            
            if (this.hideVideoBtn) {
                this.hideVideoBtn.textContent = this.isVideoHidden ? '👁️ Show Video' : '👁️ Hide Video';
            }
            
            // Add/remove blur effect to local video
            if (this.myVideo) {
                this.myVideo.style.filter = this.isVideoHidden ? 'blur(10px)' : 'none';
            }
            
            this.updateStatus(this.isVideoHidden ? "👁️ Video hidden" : "👁️ Video visible");
        }
    }
    
    enableCallControls(enabled) {
        if (this.endCallBtn) {
            this.endCallBtn.disabled = !enabled;
            this.endCallBtn.style.opacity = enabled ? '1' : '0.5';
        }
        
        if (this.muteAudioBtn) {
            this.muteAudioBtn.disabled = !enabled;
            this.muteAudioBtn.style.opacity = enabled ? '1' : '0.5';
        }
        
        if (this.hideVideoBtn) {
            this.hideVideoBtn.disabled = !enabled;
            this.hideVideoBtn.style.opacity = enabled ? '1' : '0.5';
        }
    }
    
    startCallTimer() {
        this.stopCallTimer(); // Clear any existing timer
        
        this.callDurationInterval = setInterval(() => {
            if (this.connectionStartTime) {
                const duration = Math.floor((Date.now() - this.connectionStartTime) / 1000);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                
                // Update call info in lobby if available
                const callWith = document.getElementById('call-with');
                if (callWith && this.friendInfo) {
                    callWith.textContent = `In call with ${this.friendInfo.userName} (${minutes}:${seconds.toString().padStart(2, '0')})`;
                }
            }
        }, 1000);
    }
    
    stopCallTimer() {
        if (this.callDurationInterval) {
            clearInterval(this.callDurationInterval);
            this.callDurationInterval = null;
        }
    }
    
    updateStatus(message) {
        if (this.status) {
            // Add user name to status if logged in
            const prefix = this.userName ? `👤 ${this.userName}: ` : '';
            this.status.textContent = prefix + message;
        }
        
        // Also log to console with timestamp
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${message}`);
    }
    
    // 🧹 Clean up when user logs out
    cleanup() {
        console.log("🧹 Cleaning up video chat...");
        
        // Stop camera
        if (this.myStream) {
            this.myStream.getTracks().forEach(track => track.stop());
            this.myStream = null;
        }
        
        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Stop timers
        this.stopCallTimer();
        
        // Clear video elements
        if (this.myVideo) this.myVideo.srcObject = null;
        if (this.friendVideo) this.friendVideo.srcObject = null;
        
        // Reset UI
        if (this.startBtn) {
            this.startBtn.textContent = '🎥 Start Camera';
            this.startBtn.style.background = '#4CAF50';
            this.startBtn.disabled = true;
        }
        
        if (this.detectBtn) {
            this.detectBtn.disabled = true;
            this.detectBtn.textContent = '✋ Start Sign Detection';
            this.detectBtn.style.background = '#2196F3';
        }
        
        if (this.remoteUserName) {
            this.remoteUserName.textContent = "Waiting for connection...";
        }
        
        // Disable call controls
        this.enableCallControls(false);
        
        this.currentUser = null;
        this.friendInfo = null;
        
        console.log("✅ Video chat cleaned up");
    }
}

// Initialize video chat when page loads
window.addEventListener('load', () => {
    console.log("🎬 Initializing Video Chat system...");
    
    // Create global instance
    window.videoChat = new VideoChat();
    
    // Listen for auth state changes
    if (window.auth) {
        // For Firebase v8
        window.auth.onAuthStateChanged((user) => {
            if (user) {
                // User logged in - setup video chat
                setTimeout(() => {
                    window.videoChat.setupAfterLogin(user);
                }, 500);
            } else {
                // User logged out - cleanup
                window.videoChat.cleanup();
            }
        });
    } else {
        console.log("⚠️ Firebase auth not available yet");
        
        // Fallback: Check every second for auth
        const checkAuthInterval = setInterval(() => {
            if (window.auth) {
                clearInterval(checkAuthInterval);
                window.auth.onAuthStateChanged((user) => {
                    if (user) {
                        window.videoChat.setupAfterLogin(user);
                    } else {
                        window.videoChat.cleanup();
                    }
                });
            }
        }, 1000);
    }
    
    // Add global error handler
    window.addEventListener('error', (event) => {
        console.error("🌐 Global error:", event.error);
        if (window.videoChat) {
            window.videoChat.updateStatus("⚠️ An error occurred. Please refresh.");
        }
    });
    
    // Make videoChat accessible to lobby
    window.getVideoChat = () => window.videoChat;
});