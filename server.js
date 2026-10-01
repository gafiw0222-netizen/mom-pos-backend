// 📋 จัดการคิวออเดอร์ครัวและประวัติรายวัน
let kitchenOrders = [];
let completedOrders = []; // เก็บประวัติออเดอร์ที่ทำเสร็จแล้วของวันนี้

app.get("/api/kitchen-orders", (req, res) => {
  res.json(kitchenOrders);
});

app.get("/api/kitchen-history", (req, res) => {
  res.json(completedOrders);
});

app.delete("/api/kitchen-history", (req, res) => {
  completedOrders = [];
  res.json({ success: true });
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("send_to_kitchen", (data) => {
    const orderWithTime = { ...data, receivedAt: Date.now() };
    kitchenOrders.push(orderWithTime);
    io.emit("receive_order", orderWithTime);
  });

  // ย้ายจากกำลังทำไปเป็นประวัติที่ทำเสร็จแล้ว
  socket.on("finish_order", (id) => {
    const orderIndex = kitchenOrders.findIndex(o => o.id == id);
    if (orderIndex !== -1) {
      const [order] = kitchenOrders.splice(orderIndex, 1);
      order.completedAt = Date.now();
      completedOrders.unshift(order); // เอาอันล่าสุดไว้บนสุด
    }
    io.emit("state_updated", { active: kitchenOrders, history: completedOrders });
  });

  // กู้คืนออเดอร์จากประวัติกลับมาทำใหม่ (กรณีเผลอกดผิด)
  socket.on("revert_order", (id) => {
    const historyIndex = completedOrders.findIndex(o => o.id == id);
    if (historyIndex !== -1) {
      const [order] = completedOrders.splice(historyIndex, 1);
      delete order.completedAt;
      kitchenOrders.push(order);
    }
    io.emit("state_updated", { active: kitchenOrders, history: completedOrders });
  });

  socket.on("clear_history", () => {
    completedOrders = [];
    io.emit("history_cleared");
  });
});