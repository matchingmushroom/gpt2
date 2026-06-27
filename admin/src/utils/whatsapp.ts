import type { Order, NotificationSettings, StoreSettings } from "../types";
import { toBSString } from "./nepaliDate";

function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-+]/g, "");
}

function orderDate(order: Order): string {
  return order.createdAt?.seconds
    ? toBSString(new Date(order.createdAt.seconds * 1000))
    : toBSString(new Date());
}

export function notifyNewOrder(order: Order, settings: NotificationSettings, store: StoreSettings): string {
  const phone = cleanPhone(order.customerPhone);
  const message = encodeURIComponent(
    `🛵 *New Order Received!*\n\n` +
    `*Store:* ${store.storeName || "Great Pickle Taste"}\n` +
    `*Order:* ${order.orderNumber}\n` +
    `*Date:* ${orderDate(order)}\n` +
    `*Customer:* ${order.customerName}\n` +
    `*Phone:* ${order.customerPhone}\n` +
    `*Address:* ${order.shippingAddress}\n` +
    `*Items:* ${order.items.length} item(s)\n` +
    `*Total:* NPR ${order.grandTotal.toLocaleString()}\n` +
    `*Payment:* ${order.paymentMethod.toUpperCase()}\n\n` +
    `Please process the order.`
  );
  return `https://wa.me/${cleanPhone(settings.whatsappBusinessNumber)}?text=${message}`;
}

export function notifyStatusUpdate(order: Order, settings: NotificationSettings, store: StoreSettings): string {
  const statusEmojis: Record<string, string> = {
    pending: "⏳",
    confirmed: "✅",
    processing: "👨‍🍳",
    shipped: "🚚",
    delivered: "🎉",
    cancelled: "❌",
    returned: "🔄",
  };
  const emoji = statusEmojis[order.status] || "📋";
  const message = encodeURIComponent(
    `${emoji} *Order Update - ${store.storeName || "Great Pickle Taste"}*\n\n` +
    `*Order:* ${order.orderNumber}\n` +
    `*Status:* ${order.status.toUpperCase()}\n` +
    `*Total:* NPR ${order.grandTotal.toLocaleString()}\n\n` +
    `Thank you for your order!`
  );
  return `https://wa.me/${cleanPhone(order.customerPhone)}?text=${message}`;
}

export function notifyCustomer(order: Order, phone: string, storeName: string): string {
  const message = encodeURIComponent(
    `📋 *Order Summary - ${storeName || "Great Pickle Taste"}*\n\n` +
    `*Order:* ${order.orderNumber}\n` +
    `*Status:* ${order.status.toUpperCase()}\n` +
    `*Items:* ${order.items.length}\n` +
    `*Total:* NPR ${order.grandTotal.toLocaleString()}\n\n` +
    `Track your order on our website.`
  );
  return `https://wa.me/${cleanPhone(phone)}?text=${message}`;
}
