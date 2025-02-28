import express from "express";
import http from "http";
import { Server } from "socket.io";
// import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins (change in production)
        methods: ["GET", "POST"]
    }
});

let rooms = {}; // Store active game rooms
let hostSocket = null;
let scorePlayer1 = 0;
let scorePlayer2 = 0;
io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Create Room'

    socket.on("checkHost", () => {
        console.log(`Checking host for ${socket.id}. Current host: ${hostSocket ? hostSocket.id : "None"}`);
        // if (hostSocket === null) socket.emit("noh", true);
        socket.emit("setHost", hostSocket && (socket.id === hostSocket.id));
    });
    socket.on("tankHit", ({ player }) => {
        if (player === 1) {
            scorePlayer2 += 0.5;
        } else if (player === 2) {
            scorePlayer1 += 0.5;
        }

        io.emit("scoreUpdate", { score1: scorePlayer1, score2: scorePlayer2 }); // Send updated scores
    });


    socket.on("createRoom", () => {
        const roomKey = Math.random().toString(36).substr(2, 6).toUpperCase();
        rooms[roomKey] = { players: [socket.id], createdBy: socket.id };
        socket.join(roomKey);
        socket.emit("roomCreated", roomKey);
        console.log(`Room created: ${roomKey}, by ${socket.id}`);

        if (!hostSocket || !hostSocket.id) {
            hostSocket = socket;
            console.log("I am the host:", hostSocket.id);
        }
    });


    // Join Room

    socket.on("joinRoom", (roomKey) => {
        console.log(`User ${socket.id} trying to join room: ${roomKey}`);
        console.log("Current rooms:", rooms);


        if (rooms[roomKey]) {
            if (rooms[roomKey].players.length < 2) {
                rooms[roomKey].players.push(socket.id);
                socket.join(roomKey);
                io.to(roomKey).emit("startGame", roomKey);
                console.log(`User ${socket.id} joined room: ${roomKey}`);
            } else {
                socket.emit("error", "Room is full");
            }
        } else {
            socket.emit("error", "Room not found");
        }
    });
    socket.on("playerMove", (data) => {
        const { x, y, rotation, player } = data;

        // if (rooms[roomKey]) {
        // Send updated position to all players in the room
        socket.broadcast.emit("updatePosition", { x, y, rotation, player });
        // }
    });
    socket.on("fireBullet", (data) => {
        const { x, y, rotation, player } = data;

        // if (rooms[roomKey]) {
        // Broadcast bullet event to the other player in the room
        socket.broadcast.emit("bulletFired", { x, y, rotation, player });
        // }
    });


    // Handle Game Over
    socket.on("gameOver", ({ roomKey, winner }) => {
        io.to(roomKey).emit("gameResult", winner);
        delete rooms[roomKey]; // Remove room after game ends
        console.log(`Game over in room: ${roomKey}, winner: ${winner}`);
    });

    // Handle Disconnections
    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);

        if (hostSocket && socket.id === hostSocket.id) {
            console.log("Host disconnected, assigning new host...");
            hostSocket = null; // Reset host

            // Assign a new host if there are other players in a room
            for (const roomKey in rooms) {
                if (rooms[roomKey].players.length > 0) {
                    hostSocket = io.sockets.sockets.get(rooms[roomKey].players[0]); // Get first player in the room
                    console.log(`New host assigned: ${hostSocket?.id}`);
                    hostSocket?.emit("setHost", true);
                    break;
                }
            }
        }

        for (const room in rooms) {
            rooms[room].players = rooms[room].players.filter(id => id !== socket.id);

            if (rooms[room].players.length === 0 || rooms[room].createdBy === socket.id) {
                console.log(`Room ${room} deleted due to disconnection`);
                delete rooms[room];
            }
        }
    });

});

server.listen(5000, () => console.log("Server running on port 5000"));
