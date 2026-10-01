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

const kitchenOrderSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  table: String,
  items: Array,
  receivedAt: { type: Number, default: Date.now }
});
const KitchenOrder = mongoose.model("KitchenOrder", kitchenOrderSchema);

const kitchenHistorySchema = new mongoose.Schema({
  id: String,
  table: String,
  items: Array,
  receivedAt: Number,
  completedAt: { type: Number, default: Date.now }
});
const KitchenHistory = mongoose.model("KitchenHistory", kitchenHistorySchema);

// ฟังก์ชันคำนวณยอดเงิน (รองรับเคสลาบปลาดุก ป้า 40 / แม่ 20)
const calculateTotals = (items) => {
  let momTotal = 0;
  let auntTotal = 0;

  items.forEach(item => {
    const qty = Number(item.quantity) || 1;
    const itemTotal = Number(item.price) * qty;

    if (item.name === "ลาบปลาดุก") {
      auntTotal += 40 * qty;
      momTotal += 20 * qty;
    } else if (item.kitchen === "aunt") {
      auntTotal += itemTotal;
    } else {
      momTotal += itemTotal;
    }
  });

  return { momTotal, auntTotal, grandTotal: momTotal + auntTotal };
};

app.post("/api/bills", async (req, res) => {
  try {
    const { table, items, createdAt } = req.body;
    const { momTotal, auntTotal, grandTotal } = calculateTotals(items);

    const newBill = new Bill({ table, items, momTotal, auntTotal, grandTotal, createdAt });
    await newBill.save();
    res.status(201).json({ success: true, message: "บันทึกบิลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/bills", async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/bills/:id", async (req, res) => {
  try {
    const { table, items } = req.body;
    const { momTotal, auntTotal, grandTotal } = calculateTotals(items);

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

app.delete("/api/bills/:id", async (req, res) => {
  try {
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "ลบบิลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/kitchen-orders", async (req, res) => {
  try {
    const orders = await KitchenOrder.find().sort({ receivedAt: 1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/kitchen-history", async (req, res) => {
  try {
    const history = await KitchenHistory.find().sort({ completedAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/kitchen-history", async (req, res) => {
  try {
    await KitchenHistory.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on("connection", (socket) => {
  socket.on("send_to_kitchen", async (data) => {
    try {
      const orderWithTime = { 
        id: data.id || String(Date.now()), 
        table: data.table, 
        items: data.items, 
        receivedAt: Date.now() 
      };
      await KitchenOrder.create(orderWithTime);
      io.emit("receive_order", orderWithTime);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("finish_order", async (id) => {
    try {
      const order = await KitchenOrder.findOneAndDelete({ id: String(id) });
      if (order) {
        await KitchenHistory.create({
          id: order.id,
          table: order.table,
          items: order.items,
          receivedAt: order.receivedAt,
          completedAt: Date.now()
        });
      }
      const active = await KitchenOrder.find().sort({ receivedAt: 1 });
      const history = await KitchenHistory.find().sort({ completedAt: -1 });
      io.emit("state_updated", { active, history });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("revert_order", async (id) => {
    try {
      const historyOrder = await KitchenHistory.findOneAndDelete({ id: String(id) });
      if (historyOrder) {
        await KitchenOrder.create({
          id: historyOrder.id,
          table: historyOrder.table,
          items: historyOrder.items,
          receivedAt: historyOrder.receivedAt
        });
      }
      const active = await KitchenOrder.find().sort({ receivedAt: 1 });
      const history = await KitchenHistory.find().sort({ completedAt: -1 });
      io.emit("state_updated", { active, history });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("clear_history", async () => {
    try {
      await KitchenHistory.deleteMany({});
      io.emit("history_cleared");
    } catch (e) {
      console.error(e);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});