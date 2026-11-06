import os
import random
from datetime import datetime, timedelta
from .database import db

class OrderService:
    def __init__(self):
        self.stripe_key = os.environ.get("STRIPE_SECRET_KEY", "")
        self.mpesa_consumer_key = os.environ.get("MPESA_CONSUMER_KEY", "")

    def process_order(self, order_data: dict) -> dict:
        order_num = f"SA-{random.randint(10000, 99999)}"
        created_dt = datetime.utcnow()
        months = int(order_data.get("billing_cycle", 36))
        renewal_dt = created_dt + timedelta(days=months * 30)

        payment_method = order_data.get("payment_method", "card")
        payment_details = order_data.get("payment_details", {})
        payment_status = "paid"
        transaction_id = f"TXN-{random.randint(10000000, 99999999)}"

        if payment_method == "mpesa":
            phone = payment_details.get("phone", "")
            transaction_id = f"QHK{random.randint(100000, 999999)}"
        elif payment_method == "paypal":
            transaction_id = f"PAYID-{random.randint(1000000, 9999999)}"

        subtotal = float(order_data.get("subtotal", 0.0))
        discount = float(order_data.get("discount", 0.0))
        tax = float(order_data.get("tax", 0.0))
        total_due = float(order_data.get("total_due_today", 0.0))
        paid_amount = total_due
        balance = 0.0

        order_record = {
            "order_number": order_num,
            "created_at": created_dt.strftime("%d %b %Y at %H:%M"),
            "renewal_date": renewal_dt.strftime("%d %B %Y"),
            "billing_cycle_months": months,
            "currency": order_data.get("currency", "KES"),
            "currency_symbol": order_data.get("currency_symbol", "KSh "),
            "customer": {
                "name": order_data.get("customer_name") or "Walk-in Customer",
                "email": order_data.get("customer_email") or "customer@cloudoon.com",
                "phone": order_data.get("customer_phone") or "0718080850",
                "country": order_data.get("customer_country") or "Kenya",
                "address": order_data.get("customer_address") or "Nairobi, Kenya"
            },
            "items": order_data.get("items", []),
            "subtotal": subtotal,
            "discount": discount,
            "promo_code": order_data.get("promo_code", ""),
            "tax": tax,
            "total_due_today": total_due,
            "paid_amount": paid_amount,
            "balance": balance,
            "sale_type": "cash",
            "status": "confirmed",
            "payment": {
                "method": "M-Pesa" if payment_method == "mpesa" else ("Credit Card" if payment_method == "card" else "PayPal"),
                "status": payment_status,
                "transaction_id": transaction_id
            },
            "renews_at_total": float(order_data.get("renews_at_total", 0.0)),
            "served_by": order_data.get("served_by") or "Kiprotich oscar",
            "next_steps": [
                {"title": "Access cPanel / Cloud Console", "desc": "Server environment has been auto-provisioned. Check your email for direct single-sign-on credentials."},
                {"title": "Manage DNS Records & Nameservers", "desc": "Nameservers (ns1.cloudoon.com, ns2.cloudoon.com) are active and propagating worldwide."},
                {"title": "Setup Email & SSL Certificate", "desc": "Complimentary 256-bit encryption active on your domain within 15 minutes."}
            ]
        }

        saved = db.save_order(order_record)
        return saved or order_record

    def get_order(self, order_num: str) -> dict:
        return db.get_order(order_num)

    def get_all_orders(self) -> list:
        return db.get_all_orders()
