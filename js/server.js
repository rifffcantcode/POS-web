require("dotenv").config();

const express = require("express");
const cors = require("cors");
const midtransClient = require("midtrans-client");
const admin = require("firebase-admin");

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= FIREBASE INIT =================
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

// ================= MIDTRANS INIT =================
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

// ================= CREATE TRANSACTION =================
app.post("/create-transaction", async (req, res) => {
  try {
    const { cart, orderId, userId } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: "Cart kosong" });
    }

    // 💰 hitung total dari backend (lebih aman)
    const total = cart.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    const finalOrderId = orderId || "INV-" + Date.now();

    const parameter = {
      transaction_details: {
        order_id: finalOrderId,
        gross_amount: total,
      },
      credit_card: {
        secure: true,
      },
    };

    const transaction = await snap.createTransaction(parameter);

    console.log("Create TX:", finalOrderId);

const now = Date.now();

await db.collection("sales").add({
  orderId: finalOrderId,
  userId: userId || "guest",
  items: cart,
  total,
  status: "pending",
  snapToken: transaction.token,
  date: new Date()
});

    res.json({
      token: transaction.token,
    });

  } catch (error) {
    console.error("ERROR CREATE TX:", error);
    res.status(500).json({ error: "Gagal create transaksi" });
  }
});

// ================= MIDTRANS WEBHOOK =================
app.post("/midtrans-webhook", async (req, res) => {
  try {
    const notif = req.body;

    const orderId = notif.order_id;
    const status = notif.transaction_status;

    console.log("Webhook:", orderId, status);

    let finalStatus = "pending";

    if (status === "settlement") finalStatus = "success";
    else if (status === "expire" || status === "cancel") finalStatus = "failed";

    // 🔥 update Firestore
    const snapshot = await db.collection("sales")
      .where("orderId", "==", orderId)
      .get();

    snapshot.forEach(doc => {
      doc.ref.update({
        status: finalStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.sendStatus(200);

  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    res.sendStatus(500);
  }
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.send("API jalan 🚀");
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});