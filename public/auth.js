// This handles all login/signup stuff!
class AuthManager {
    constructor() {
        this.loginBtn = document.getElementById('login-btn');
        this.logoutBtn = document.getElementById('logout-btn');
        this.signupBtn = document.getElementById('signup-btn');
        this.authContainer = document.getElementById('auth-container');
        this.chatContainer = document.getElementById('chat-container');
        this.userNameDisplay = document.getElementById('user-name');
        
        this.currentUser = null;
        this.setup();
    }
    
    setup() {
        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.userLoggedIn(user);
            } else {
                this.userLoggedOut();
            }
        });
        
        // Setup button listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Login with email/password
        document.getElementById('login-email-btn').onclick = () => {
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            this.loginWithEmail(email, password);
        };
        
        // Signup with email/password
        document.getElementById('signup-email-btn').onclick = () => {
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const name = document.getElementById('signup-name').value;
            this.signupWithEmail(email, password, name);
        };
        
        // Login with Google
        document.getElementById('google-login-btn').onclick = () => {
            this.loginWithGoogle();
        };
        
        // Logout button
        if (this.logoutBtn) {
            this.logoutBtn.onclick = () => {
                this.logout();
            };
        }
        
        // Switch between login/signup forms
        document.getElementById('show-signup').onclick = () => {
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('signup-form').style.display = 'block';
        };
        
        document.getElementById('show-login').onclick = () => {
            document.getElementById('signup-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
        };
    }
    
    async loginWithEmail(email, password) {
        try {
            const result = await auth.signInWithEmailAndPassword(email, password);
            console.log("✅ Login successful!");
            return result.user;
        } catch (error) {
            this.showError("Login failed: " + error.message);
            return null;
        }
    }
    
    async signupWithEmail(email, password, name) {
        try {
            // Create user
            const result = await auth.createUserWithEmailAndPassword(email, password);
            
            // Update display name
            await result.user.updateProfile({
                displayName: name
            });
            
            // Save additional info to Firestore (optional)
            await db.collection('users').doc(result.user.uid).set({
                name: name,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isDeaf: document.getElementById('is-deaf').checked
            });
            
            console.log("🎉 Signup successful!");
            return result.user;
        } catch (error) {
            this.showError("Signup failed: " + error.message);
            return null;
        }
    }
    
    async loginWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            console.log("✅ Google login successful!");
            
            // Check if user exists in Firestore
            const userDoc = await db.collection('users').doc(result.user.uid).get();
            if (!userDoc.exists) {
                // First time login - save user info
                await db.collection('users').doc(result.user.uid).set({
                    name: result.user.displayName,
                    email: result.user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isDeaf: false // Default value
                });
            }
            
            return result.user;
        } catch (error) {
            this.showError("Google login failed: " + error.message);
            return null;
        }
    }
    
    async logout() {
        try {
            await auth.signOut();
            console.log("👋 Logged out successfully");
        } catch (error) {
            console.error("Logout error:", error);
        }
    }
    
    userLoggedIn(user) {
      this.currentUser = user;
      console.log("👤 User logged in:", user.email);
      
      // Show chat interface, hide login
      if (this.authContainer) this.authContainer.style.display = 'none';
      if (this.chatContainer) this.chatContainer.style.display = 'block';
      
      // Show user name
      if (this.userNameDisplay) {
          this.userNameDisplay.textContent = user.displayName || user.email;
      }
      
      // Initialize video chat after login
      if (window.videoChat) {
          window.videoChat.setupAfterLogin(user);
      }
      
      // 🔥 NEW: Initialize lobby system
      if (window.lobbyManager) {
          window.lobbyManager.initialize(user);
      }
  }
    
    userLoggedOut() {
        this.currentUser = null;
        console.log("🚪 User logged out");
        
        if (window.lobbyManager) {
          window.lobbyManager.cleanup();
      }
    
        // Show login interface, hide chat
        if (this.authContainer) this.authContainer.style.display = 'block';
        if (this.chatContainer) this.chatContainer.style.display = 'none';
        
        // Reset to login form
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('signup-form').style.display = 'none';
        
        // Clear form fields
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    }
    
    showError(message) {
        // Show error message
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            
            // Hide error after 5 seconds
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
        console.error("❌ Error:", message);
    }
    
    getCurrentUser() {
        return this.currentUser;
    }
}

// Start auth manager when page loads
window.addEventListener('load', () => {
    window.authManager = new AuthManager();
});