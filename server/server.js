const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Store online users
const onlineUsers = new Map(); // socketId -> userData

app.use(express.static(path.join(__dirname, '../public')));

io.on('connection', (socket) => {
    console.log('🎮 New connection:', socket.id);

    // User joins lobby
    socket.on('join-lobby', (userData) => {
        console.log('👤 User joined lobby:', userData.userName);
        
        // Store user info
        onlineUsers.set(socket.id, {
            socketId: socket.id,
            userId: userData.userId,
            userName: userData.userName,
            status: 'online', // online, busy, away
            isAvailable: true
        });

        // Send updated user list to everyone
        broadcastUserList();
        
        // Welcome message to the new user
        socket.emit('lobby-welcome', {
            message: `Welcome to the lobby, ${userData.userName}!`,
            users: getUsersList()
        });
    });

    // User requests to call another user
    socket.on('request-call', (data) => {
        const { toUserId, fromUserId, fromUserName } = data;
        
        console.log(`📞 Call request: ${fromUserName} → ${toUserId}`);
        
        // Find target user's socket
        let targetSocketId = null;
        for (const [sockId, user] of onlineUsers.entries()) {
            if (user.userId === toUserId) {
                targetSocketId = sockId;
                break;
            }
        }

        if (targetSocketId) {
            // Send call request to target
            io.to(targetSocketId).emit('incoming-call', {
                fromUserId: fromUserId,
                fromUserName: fromUserName,
                callId: generateCallId(),
                timestamp: new Date().toISOString()
            });

            // Update caller status to "waiting"
            updateUserStatus(socket.id, 'busy');
            
            socket.emit('call-request-sent', {
                toUserId: toUserId,
                message: 'Call request sent!'
            });
        } else {
            socket.emit('call-error', {
                message: 'User is not available'
            });
        }
    });

    // User accepts a call
    socket.on('accept-call', (data) => {
        const { callId, fromUserId, toUserId } = data;
        
        console.log(`✅ Call accepted: ${callId}`);
        
        // Find both users' sockets
        let callerSocketId = null;
        let calleeSocketId = socket.id; // Current socket is the one accepting
        
        for (const [sockId, user] of onlineUsers.entries()) {
            if (user.userId === fromUserId) {
                callerSocketId = sockId;
                break;
            }
        }

        if (callerSocketId && calleeSocketId) {
            // Create a room for this call
            const roomId = `call-${callId}`;
            
            // Join both users to the room
            socket.join(roomId); // Callee
            io.sockets.sockets.get(callerSocketId)?.join(roomId); // Caller
            
            // Update both users' status
            updateUserStatus(callerSocketId, 'in-call');
            updateUserStatus(calleeSocketId, 'in-call');
            
            // Notify both users to start call
            io.to(roomId).emit('call-started', {
                callId: callId,
                roomId: roomId,
                users: [
                    onlineUsers.get(callerSocketId),
                    onlineUsers.get(calleeSocketId)
                ]
            });

            // Update lobby for everyone else
            broadcastUserList();
        }
    });

    // User rejects a call
    socket.on('reject-call', (data) => {
        const { callId, fromUserId } = data;
        
        // Find caller's socket
        let callerSocketId = null;
        for (const [sockId, user] of onlineUsers.entries()) {
            if (user.userId === fromUserId) {
                callerSocketId = sockId;
                break;
            }
        }

        if (callerSocketId) {
            // Notify caller
            io.to(callerSocketId).emit('call-rejected', {
                callId: callId,
                message: 'Call was rejected'
            });

            // Update caller status back to available
            updateUserStatus(callerSocketId, 'online');
            updateUserStatus(socket.id, 'online');
            
            broadcastUserList();
        }
    });

    // User ends a call
    socket.on('end-call', (data) => {
        const { callId } = data;
        const roomId = `call-${callId}`;
        
        // Notify all in the room
        io.to(roomId).emit('call-ended', {
            callId: callId,
            message: 'Call ended'
        });

        // Leave the room
        socket.leave(roomId);
        
        // Update user status
        updateUserStatus(socket.id, 'online');
        broadcastUserList();
    });

    // Handle WebRTC signaling within a call
    socket.on('webrtc-signal', (data) => {
        const { toUserId, signal, callId } = data;
        
        // Find target socket
        let targetSocketId = null;
        for (const [sockId, user] of onlineUsers.entries()) {
            if (user.userId === toUserId) {
                targetSocketId = sockId;
                break;
            }
        }

        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc-signal', {
                fromUserId: onlineUsers.get(socket.id).userId,
                signal: signal,
                callId: callId
            });
        }
    });

    // User leaves lobby
    socket.on('leave-lobby', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            console.log('👋 User left lobby:', user.userName);
            onlineUsers.delete(socket.id);
            broadcastUserList();
        }
    });

    // User disconnects
    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            console.log('🔌 User disconnected:', user.userName);
            onlineUsers.delete(socket.id);
            broadcastUserList();
        }
        console.log(`👥 Users online: ${onlineUsers.size}`);
    });

    // Helper functions
    function broadcastUserList() {
        const usersList = getUsersList();
        io.emit('users-update', usersList);
    }

    function getUsersList() {
        return Array.from(onlineUsers.values()).map(user => ({
            userId: user.userId,
            userName: user.userName,
            status: user.status,
            isAvailable: user.isAvailable,
            socketId: user.socketId
        }));
    }

    function updateUserStatus(socketId, status) {
        const user = onlineUsers.get(socketId);
        if (user) {
            user.status = status;
            user.isAvailable = (status === 'online');
            onlineUsers.set(socketId, user);
        }
    }

    function generateCallId() {
        return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🤖 Server running: http://localhost:${PORT}`);
});