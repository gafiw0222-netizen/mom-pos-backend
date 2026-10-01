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

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI; 
mongoose.connect(MONGO_URI)
  .then(() => console.log("🟢 เชื่อมต่อ MongoDB สำเร็จ!"))
  .catch(err => console.log("❌ เชื่อมต่อ MongoDB ไม่สำเร็จ:", err));

const billSchema = new mongoose.Schema({
  table: String,
  items: Array,
  momTotal: Number,
  auntTotal: Number,
  grandTotal: Number,
  createdAt: { type: Date, default: Date.now }
});
const Bill = mongoose.model("Bill", billSchema);

// บันทึกบิล
app.post("/api/bills", async (req, res) => {
  try {
    const newBill = new Bill(req.body);
    await newBill.save();
    res.status(201).json({ success: true, message: "บันทึกบิลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ดึงประวัติบิล
app.get("/api/bills", async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// แก้ไขบิล (แก้โต๊ะ/ลบเมนู/เพิ่มเมนู)
app.put("/api/bills/:id", async (req, res) => {
  try {
    const { table, items } = req.body;
    const momTotal = items.filter((i) => i.owner === "mom").reduce((sum, i) => sum + Number(i.price), 0);
    const auntTotal = items.filter((i) => i.owner === "aunt").reduce((sum, i) => sum + Number(i.price), 0);
    const grandTotal = momTotal + auntTotal;

    const updatedBill = await Bill.findByIdAndUpdate(
      req.params.id,
      { table, items, momTotal, auntTotal, grandTotal },
      { new: true }
    );
    res.json({ success: true, message: "แก้ไขบิลสำเร็จ", data: updatedBill });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ลบบิล
app.delete("/api/bills/:id", async (req, res) => {
  try {
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "ลบบิลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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