import os

class PricingService:
    def __init__(self):
        self.exchange_api_key = os.environ.get("EXCHANGE_RATES_API_KEY", "")
        self.currencies = {
            "USD": {"symbol": "$", "rate": 1.0, "tax_rate": 0.0, "tax_name": "Sales Tax"},
            "EUR": {"symbol": "€", "rate": 0.92, "tax_rate": 0.0, "tax_name": "VAT"},
            "GBP": {"symbol": "£", "rate": 0.79, "tax_rate": 0.0, "tax_name": "VAT"},
            "KES": {"symbol": "KSh", "rate": 130.0, "tax_rate": 0.16, "tax_name": "VAT (16%)"}
        }

        self.billing_cycles = {
            1: {"months": 1, "discount_pct": 0, "badge": "Standard Rate"},
            12: {"months": 12, "discount_pct": 20, "badge": "Save 20%"},
            24: {"months": 24, "discount_pct": 30, "badge": "Save 30%"},
            36: {"months": 36, "discount_pct": 40, "badge": "Save 40% - Best Value"}
        }

        self.promos = {
            "SAVE10": {"discount_pct": 10, "description": "10% Welcome Discount"},
            "CLOUD30": {"discount_pct": 30, "description": "30% Launch Special Discount"}
        }

        self.catalog = {
            "shared": {
                "web-starter": {
                    "id": "web-starter",
                    "name": "Shared Hosting - Web Starter",
                    "category": "shared",
                    "monthly_base": 3.60,
                    "monthly_renewal": 5.99,
                    "popular": False,
                    "specs": ["1 Website", "30 GB SSD Storage", "Unmetered Bandwidth", "Free SSL Certificate", "24/7 Support"]
                },
                "wordpress-pro": {
                    "id": "wordpress-pro",
                    "name": "Shared Hosting - WordPress Pro",
                    "category": "shared",
                    "monthly_base": 5.90,
                    "monthly_renewal": 9.99,
                    "popular": True,
                    "specs": ["Unlimited Websites", "100 GB SSD Storage", "Managed WordPress Updates", "Advanced Staging & Caching", "Malware Scanning & Removal"]
                },
                "woocommerce-growth": {
                    "id": "woocommerce-growth",
                    "name": "Shared Hosting - WooCommerce Growth",
                    "category": "shared",
                    "monthly_base": 11.90,
                    "monthly_renewal": 18.99,
                    "popular": False,
                    "specs": ["Optimized WooCommerce Engine", "200 GB NVMe Storage", "Free Dedicated IP", "Automated Daily Backups", "VIP Priority Support"]
                }
            },
            "vps": {
                "base_monthly": 19.90,
                "base_renewal": 29.90,
                "cpu_unit_cost": 4.00,
                "ram_gb_cost": 2.50,
                "storage_10gb_cost": 1.00,
                "managed_addon": 15.00
            },
            "dedicated": {
                "intel-xeon-entry": {
                    "id": "intel-xeon-entry",
                    "name": "Dedicated - Intel Xeon E-2388G",
                    "monthly_base": 119.00,
                    "monthly_renewal": 149.00,
                    "specs": ["8 Cores / 16 Threads @ 3.2GHz", "64 GB DDR4 ECC RAM", "2x 960 GB NVMe SSD (RAID 1)", "1 Gbps Unmetered Bandwidth"]
                },
                "amd-epyc-pro": {
                    "id": "amd-epyc-pro",
                    "name": "Dedicated - AMD EPYC 7443P",
                    "monthly_base": 199.00,
                    "monthly_renewal": 249.00,
                    "specs": ["24 Cores / 48 Threads @ 2.85GHz", "128 GB DDR4 ECC RAM", "2x 1.92 TB Enterprise NVMe", "10 Gbps Burst Bandwidth"]
                },
                "dual-xeon-enterprise": {
                    "id": "dual-xeon-enterprise",
                    "name": "Dedicated - Dual Intel Xeon Gold 6330",
                    "monthly_base": 349.00,
                    "monthly_renewal": 429.00,
                    "specs": ["56 Cores / 112 Threads @ 2.0GHz", "256 GB DDR4 ECC RAM", "4x 3.84 TB NVMe U.2", "10 Gbps Dedicated Uplink"]
                }
            },
            "cloud": {
                "micro": {
                    "id": "cloud-micro",
                    "name": "Cloud Compute - General Purpose Micro",
                    "monthly_base": 12.00,
                    "monthly_renewal": 16.00,
                    "specs": ["2 vCPU, 4 GB RAM, 80 GB SSD", "Automated Failover", "Global Anycast IP"]
                },
                "standard": {
                    "id": "cloud-standard",
                    "name": "Cloud Compute - Standard Cluster",
                    "monthly_base": 36.00,
                    "monthly_renewal": 48.00,
                    "specs": ["4 vCPU, 16 GB RAM, 160 GB SSD", "High Availability Cluster", "Snapshot Backups"]
                },
                "compute-optimized": {
                    "id": "cloud-compute-optimized",
                    "name": "Cloud Compute - High Throughput",
                    "monthly_base": 78.00,
                    "monthly_renewal": 98.00,
                    "specs": ["8 vCPU, 32 GB RAM, 320 GB NVMe", "Compute Heavy Workloads", "Direct 10G Peering"]
                }
            },
            "addons": {
                "backups": {"name": "Daily Automated Backups & 1-Click Restore", "monthly_base": 2.99, "monthly_renewal": 2.99},
                "ssl": {"name": "Premium Wildcard SSL Certificate", "monthly_base": 3.49, "monthly_renewal": 3.49},
                "email": {"name": "Professional Email Accounts (5 Inboxes)", "monthly_base": 1.99, "monthly_renewal": 2.99},
                "ddos": {"name": "Enterprise DDoS Shield & WAF", "monthly_base": 4.99, "monthly_renewal": 6.99},
                "cdn": {"name": "Global Edge CDN & Image Optimizer", "monthly_base": 2.49, "monthly_renewal": 2.49},
                "whois": {"name": "WHOIS Privacy Protection", "monthly_base": 1.99, "monthly_renewal": 1.99, "yearly_only": True}
            }
        }

    def convert(self, amount: float, currency: str = "USD") -> float:
        rate = self.currencies.get(currency, self.currencies["USD"])["rate"]
        return round(amount * rate, 2)

    def validate_promo(self, code: str) -> dict:
        clean = code.strip().upper()
        if clean in self.promos:
            return {
                "valid": True,
                "code": clean,
                "discount_pct": self.promos[clean]["discount_pct"],
                "description": self.promos[clean]["description"]
            }
        return {
            "valid": False,
            "code": code,
            "message": "Invalid promotional code. Please try SAVE10 or CLOUD30."
        }

    def get_currencies(self) -> dict:
        return self.currencies

    def get_billing_cycles(self) -> dict:
        return self.billing_cycles

    def get_catalog(self) -> dict:
        return self.catalog

