const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// 1. เชื่อมต่อ MongoDB (ใช้ลิงก์เดิมของคุณ)
const MONGO_URI = process.env.MONGO_URI || "ใส่ลิงก์ MongoDB ของคุณตรงนี้"; 
mongoose.connect(MONGO_URI)
  .then(() => console.log("🟢 เชื่อมต่อ MongoDB สําเร็จ!"))
  .catch(err => console.log("❌ เชื่อมต่อ MongoDB ไม่สำเร็จ:", err));

// 2. สร้างโครงสร้างข้อมูลบิล (Schema) พร้อมบันทึกเวลา
const billSchema = new mongoose.Schema({
  table: String,
  items: Array,
  momTotal: Number,
  auntTotal: Number,
  grandTotal: Number,
  createdAt: { type: Date, default: Date.now } // บันทึกเวลาแบบเรียลไทม์อัตโนมัติ
});
const Bill = mongoose.model("Bill", billSchema);

// API: บันทึกบิลเมื่อกดคิดเงิน
app.post("/api/bills", async (req, res) => {
  try {
    const newBill = new Bill(req.body);
    await newBill.save();
    res.status(201).json({ success: true, message: "บันทึกบิลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: ดึงประวัติบิลทั้งหมดมาดูย้อนหลัง
app.get("/api/bills", async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 }); // เรียงจากล่าสุดไปเก่าสุด
    res.json(bills);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: ลบบิลย้อนหลัง (กรณีคิดเงินผิด)
app.delete("/api/bills/:id", async (req, res) => {
  try {
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "ลบบิลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Socket.io สำหรับส่งออเดอร์ให้พ่อ
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  socket.on("send_to_kitchen", (data) => {
    io.emit("receive_order", data);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});