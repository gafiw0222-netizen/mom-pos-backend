const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

// สร้าง HTTP Server และเชื่อม Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // อนุญาตให้ Frontend จากทุกที่เรียกเข้ามาได้
    methods: ["GET", "POST"]
  }
});

// เชื่อมต่อ MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ เชื่อมต่อ MongoDB สำเร็จ!'))
  .catch((err) => console.error('❌ เชื่อมต่อ MongoDB ไม่สำเร็จ:', err));

// ตั้งค่า Socket.io สำหรับแจ้งเตือนแบบ Real-time
io.on('connection', (socket) => {
  console.log('⚡ มีคนเชื่อมต่อเข้ามาที่ระบบ (Socket ID:', socket.id, ')');

  // ถ้ามีการส่งข้อมูล "สั่งอาหารเข้าครัว" เข้ามา
  socket.on('send_to_kitchen', (data) => {
    console.log('ออเดอร์ใหม่เข้าครัว:', data);
    // ตะโกนบอกทุกคนที่ฟัง 'new_kitchen_order' อยู่ (ซึ่งเดี๋ยวจะเป็นเครื่องพ่อ)
    io.emit('new_kitchen_order', data); 
  });

  socket.on('disconnect', () => {
    console.log('❌ มีคนออกจากการเชื่อมต่อ');
  });
});

// หน้า API ทดสอบว่า Server วิ่งไหม
app.get('/', (req, res) => {
  res.send('Mom POS Backend is running!');
});

// รัน Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server วิ่งอยู่ที่พอร์ต ${PORT}`);
});