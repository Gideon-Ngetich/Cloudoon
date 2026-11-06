document.addEventListener('DOMContentLoaded', () => {
  const currencySelector = document.getElementById('currency-selector');
  const heroForm = document.getElementById('hero-domain-form');
  const heroInput = document.getElementById('hero-domain-input');
  const heroResults = document.getElementById('hero-domain-results');
  const tldPills = document.querySelectorAll('.hero-tld-pill');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const navCartCount = document.getElementById('nav-cart-count');
  const mainHeader = document.getElementById('main-header');

  const CURRENCY_CONFIG = {
    'USD': { rate: 1.0, sym: '$' },
    'KES': { rate: 130.0, sym: 'KSh ' },
    'EUR': { rate: 0.92, sym: '€' },
    'GBP': { rate: 0.79, sym: '£' }
  };

  let lastHeroResults = [];

  function getActiveCurrency() {
    return localStorage.getItem('cloudoon_currency') || 'KES';
  }

  function formatLandingPrice(usdAmount) {
    const curr = getActiveCurrency();
    const cfg = CURRENCY_CONFIG[curr] || CURRENCY_CONFIG['KES'];
    const val = usdAmount * cfg.rate;
    if (curr === 'KES') {
      return `${cfg.sym}${Math.round(val).toLocaleString()}`;
    }
    return `${cfg.sym}${val.toFixed(2)}`;
  }

  const savedCurrency = getActiveCurrency();
  if (currencySelector) {
    currencySelector.value = savedCurrency;
    currencySelector.addEventListener('change', (e) => {
      localStorage.setItem('cloudoon_currency', e.target.value);
      window.dispatchEvent(new CustomEvent('currencyChanged', { detail: e.target.value }));
    });
  }

  function updateCartBadge() {
    try {
      const cart = JSON.parse(localStorage.getItem('cloudoon_cart') || '[]');
      if (navCartCount) {
        navCartCount.textContent = cart.length || 0;
      }
    } catch (_e) {
      if (navCartCount) navCartCount.textContent = '0';
    }
  }
  updateCartBadge();
  window.addEventListener('storage', updateCartBadge);

  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      const isExpanded = mobileNav.classList.contains('hidden');
      mobileNav.classList.toggle('hidden');
      mobileMenuBtn.setAttribute('aria-expanded', String(isExpanded));
    });
  }

  if (mainHeader) {
    let isSticky = false;
    const outerWrapper = mainHeader.closest('div');

    function applyNavScroll() {
      const scrolled = window.scrollY > 40;
      if (scrolled && !isSticky) {
        isSticky = true;
        mainHeader.classList.remove('navbar-floating');
        mainHeader.classList.add('navbar-sticky-full');
        if (outerWrapper) {
          outerWrapper.style.paddingTop = '0';
          outerWrapper.style.paddingBottom = '0';
        }
      } else if (!scrolled && isSticky) {
        isSticky = false;
        mainHeader.classList.add('navbar-floating');
        mainHeader.classList.remove('navbar-sticky-full');
        if (outerWrapper) {
          outerWrapper.style.paddingTop = '';
          outerWrapper.style.paddingBottom = '';
        }
      }
    }

    window.addEventListener('scroll', applyNavScroll, { passive: true });
    applyNavScroll();
  }

  if (heroForm && heroInput && heroResults) {
    heroForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawQuery = heroInput.value.trim();
      if (!rawQuery) return;
      const tldSelect = document.getElementById('hero-tld-select');
      const selectedTld = tldSelect ? tldSelect.value : '.com';
      let query = rawQuery;
      if (!query.includes('.')) {
        query = query + selectedTld;
      }

      heroResults.classList.remove('hidden');
      heroResults.innerHTML = `
        <div class="flex items-center justify-center py-6 text-slate-500 gap-3">
          <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm font-medium">Checking domain availability for "${query}"...</span>
        </div>
      `;

      try {
        const res = await fetch(`/api/domains/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.status === 'success' && json.data.results.length > 0) {
          lastHeroResults = json.data.results;
          renderHeroResults(json.data.results);
        } else {
          heroResults.innerHTML = `<div class="p-4 text-center text-rose-600 text-sm">Unable to verify domain availability. Please try again.</div>`;
        }
      } catch (_err) {
        heroResults.innerHTML = `<div class="p-4 text-center text-rose-600 text-sm">Network error verifying domain.</div>`;
      }
    });

    tldPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const tld = pill.getAttribute('data-tld');
        const currentVal = heroInput.value.trim().split('.')[0] || 'mybrand';
        heroInput.value = currentVal;
        const tldSelect = document.getElementById('hero-tld-select');
        if (tldSelect) {
          for (let i = 0; i < tldSelect.options.length; i++) {
            if (tldSelect.options[i].value === tld) {
              tldSelect.selectedIndex = i;
              break;
            }
          }
        }
        heroForm.dispatchEvent(new Event('submit'));
      });
    });
  }

  function renderHeroResults(results) {
    const curr = getActiveCurrency();
    const cfg = CURRENCY_CONFIG[curr] || CURRENCY_CONFIG['KES'];

    const availableItems = results.filter(i => i.available);
    const unavailableItems = results.filter(i => !i.available);
    const displayList = [...availableItems, ...unavailableItems].slice(0, 6);

    let html = `<div class="space-y-3">`;
    displayList.forEach((item) => {
      const isAvailable = item.available;
      const firstYearPriceFormatted = formatLandingPrice(item.first_year);
      const renewalPriceFormatted = formatLandingPrice(item.renewal);

      html += `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border ${isAvailable ? 'border-emerald-300 bg-emerald-50/70 shadow-xs' : 'border-slate-200 bg-slate-50/70'} gap-3 transition-all">
          <div class="flex items-center gap-3">
            <span class="w-3.5 h-3.5 rounded-full flex-shrink-0 ${isAvailable ? 'bg-emerald-500 shadow-xs' : 'bg-slate-400'}"></span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-slate-900">${item.domain}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
                  ${isAvailable ? 'Available' : 'Taken'}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5">
                ${isAvailable ? `Renews at ${renewalPriceFormatted}/yr &bull; Includes Free DNS Management` : 'Currently registered by another party'}
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between sm:justify-end gap-2.5">
            ${isAvailable ? `
              <div class="text-right mr-1">
                <div class="text-base font-extrabold text-slate-900">${firstYearPriceFormatted}</div>
                <div class="text-[10px] text-emerald-700 font-semibold uppercase">1st Year Special</div>
              </div>
              <button type="button" class="hero-add-to-cart-btn bg-accent hover:bg-accent-hover text-accent-text text-xs font-black py-2 px-3.5 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap" data-domain="${item.domain}" data-price="${item.first_year}" data-renewal="${item.renewal}">
                Add to Cart
              </button>
              <a href="/checkout?tab=domains&domain=${encodeURIComponent(item.domain)}" class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all whitespace-nowrap">
                Checkout &rarr;
              </a>
            ` : `
              <span class="text-xs font-semibold text-slate-400">Registered</span>
              <a href="/checkout?tab=domains&domain=${encodeURIComponent(item.domain)}&transfer=1" class="border border-slate-300 hover:border-slate-400 bg-white text-slate-700 text-xs font-semibold py-1.5 px-3 rounded-xl transition-all">
                Transfer Domain
              </a>
            `}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    heroResults.innerHTML = html;

    heroResults.querySelectorAll('.hero-add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const domain = btn.getAttribute('data-domain');
        const price = parseFloat(btn.getAttribute('data-price')) || 9.99;
        const renewal = parseFloat(btn.getAttribute('data-renewal')) || 14.99;
        let cart = [];
        try {
          cart = JSON.parse(localStorage.getItem('cloudoon_cart') || '[]');
        } catch (_err) {
          cart = [];
        }
        cart = cart.filter(i => i.id !== `domain-${domain}`);
        cart.push({
          id: `domain-${domain}`,
          name: `Domain Registration (${domain})`,
          category: 'domain',
          price: price,
          total: price,
          monthly_base: price / 12,
          monthly_renewal: renewal / 12,
          is_yearly: true,
          raw_first_year: price,
          raw_renewal: renewal,
          billing_cycle: '1 Year'
        });
        localStorage.setItem('cloudoon_cart', JSON.stringify(cart));
        btn.textContent = 'Added \u2713';
        btn.classList.remove('bg-accent', 'hover:bg-accent-hover', 'bg-primary', 'hover:bg-primary-hover', 'text-accent-text');
        btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'text-white');
        updateCartBadge();
        if (window.openCartDrawer) {
          window.openCartDrawer();
        }
      });
    });
  }

  const billingToggle = document.getElementById('billing-toggle');
  const billingKnob = document.getElementById('billing-toggle-knob');

  const pricingData = {
    shared: [
      { monthly: 4.25, yearly: 3.40, title: 'Premium<br>Web Hosting', badge: 'Save 40%', desc: 'Packed with great features, such as oneclick software installs,24/7 support', plan: 'web-starter', tab: 'shared', popular: false },
      { monthly: 5.25, yearly: 4.20, title: 'VPS<br>Web Hosting', badge: '', desc: 'Packed with great features, such as oneclick software installs,24/7 support', plan: 'wordpress-pro', tab: 'shared', popular: true },
      { monthly: 7.25, yearly: 5.80, title: 'Manage<br>Dedicated Server', badge: 'Save 60%', desc: 'Packed with great features, such as oneclick software installs,24/7 support', plan: 'enterprise', tab: 'shared', popular: false },
    ],
    vps: [
      { monthly: 9.99, yearly: 7.99, title: 'VPS Starter', badge: 'Save 20%', desc: '1 vCPU, 2GB RAM, 40GB NVMe SSD for growing websites', plan: 'vps-starter', tab: 'vps', popular: false },
      { monthly: 19.99, yearly: 15.99, title: 'VPS Pro', badge: '', desc: '4 vCPU, 8GB RAM, 160GB NVMe SSD with dedicated resources', plan: 'vps-pro', tab: 'vps', popular: true },
      { monthly: 39.99, yearly: 31.99, title: 'VPS Enterprise', badge: 'Save 20%', desc: '8 vCPU, 16GB RAM, 320GB NVMe SSD for high-traffic workloads', plan: 'vps-enterprise', tab: 'vps', popular: false },
    ],
    dedicated: [
      { monthly: 79.99, yearly: 63.99, title: 'Dedicated Basic', badge: 'Save 20%', desc: 'Intel Xeon E-2236, 32GB DDR4, 2x480GB SSD managed server', plan: 'dedicated-basic', tab: 'dedicated', popular: false },
      { monthly: 149.99, yearly: 119.99, title: 'Dedicated Pro', badge: '', desc: 'Intel Xeon Silver, 64GB DDR4, 4x960GB SSD RAID10 fully managed', plan: 'dedicated-pro', tab: 'dedicated', popular: true },
      { monthly: 249.99, yearly: 199.99, title: 'Dedicated Elite', badge: 'Save 20%', desc: 'Dual Intel Xeon, 128GB DDR4, 8x960GB SSD RAID10 enterprise grade', plan: 'dedicated-elite', tab: 'dedicated', popular: false },
    ],
  };

  let currentCategory = 'shared';
  let isYearly = false;

  const extraFeatures = {
    shared: [
      ['Free Wildcard SSL Certificate', 'Unmetered High-Speed Bandwidth', '1-Click WordPress & App Installer', '24/7 Expert Help & Migration'],
      ['Dedicated vCPU and 4GB RAM', 'Full Root Access & SSH Keys', 'NVMe Gen-4 Enterprise Arrays', 'Dedicated IPv4 Address'],
      ['Isolated Bare Metal Hardware', '1 Gbps Dedicated Unmetered Port', 'Hardware RAID-10 Redundancy', 'IPMI / KVM Remote Management'],
    ],
    vps: [
      ['Full Root SSH Access', 'Dedicated IPv4 Address', 'Weekly Automated Backups', 'Basic DDoS Protection'],
      ['Priority Network Routing', 'Daily Automated Snapshots', 'Advanced DDoS Shield', 'Private VLAN Support'],
      ['Bare Metal Performance', 'Custom Kernel Configuration', 'Enterprise Firewall Rules', 'Dedicated Account Manager'],
    ],
    dedicated: [
      ['IPMI Remote Management', 'Hardware RAID Controller', '24/7 NOC Monitoring', '99.99% Network SLA'],
      ['Redundant Power Supplies', 'BGP Failover Routing', 'OS Re-imaging Included', 'Private VLAN Peering'],
      ['Custom BIOS Configuration', 'Colocation-Grade Cooling', 'Compliance-Ready Infrastructure', 'White-Glove Onboarding'],
    ],
  };

  const baseFeatures = {
    shared: ['10 GB SSD Storage', '10 MySQL Database', 'Unlimited Website', 'cPanel Control Panel', 'Auto Backup & Cloud Storage'],
    vps: ['4 vCPU Cores', '8 GB DDR4 RAM', '160 GB NVMe SSD', 'Root Access & SSH', '24/7 Priority Support'],
    dedicated: ['Dedicated CPU Cores', 'Dedicated ECC RAM', 'Enterprise NVMe Arrays', 'Managed OS Updates', '24/7 Expert NOC'],
  };

  const featureIcons = [
    '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>',
    '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7z"/></svg>',
    '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg>',
    '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>',
  ];

  function buildExpandListeners(container) {
    container.querySelectorAll('.expand-feature-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const drawer = btn.nextElementSibling;
        const label = btn.querySelector('.expand-label');
        if (drawer) {
          const isOpen = !drawer.classList.contains('hidden');
          drawer.classList.toggle('hidden', isOpen);
          if (label) {
            label.textContent = isOpen ? '\u25be Expand Feature' : '\u25b4 Collapse Feature';
          }
        }
      });
    });
  }

  function renderPricingCards(category, yearly) {
    const container = document.getElementById('pricing-cards-container');
    if (!container) return;
    const plans = pricingData[category];
    if (!plans) return;

    container.innerHTML = plans.map((plan, idx) => {
      const price = yearly ? plan.yearly : plan.monthly;
      const formattedPrice = formatLandingPrice(price);
      const period = yearly ? '/mo (billed yearly)' : '/mo';
      const ctaHref = `/checkout?tab=${plan.tab}&plan=${plan.plan}`;
      const ctaClass = plan.popular
        ? 'bg-accent hover:bg-accent-hover text-accent-text font-black shadow-lg shadow-amber-500/25'
        : 'bg-[#0B1B3D] hover:bg-[#152a5c] text-white shadow-md';

      const translateClass = plan.popular ? 'md:-translate-y-2' : '';
      const borderClass = plan.popular ? 'border-2 border-primary/20 shadow-xl' : 'border border-slate-200 shadow-sm';

      const badgeHtml = (plan.badge && !plan.popular)
        ? `<span class="card-plan-badge bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold px-3 py-1 rounded-md whitespace-nowrap flex-shrink-0">${plan.badge}</span>`
        : '';

      const ribbonHtml = plan.popular
        ? `<div class="ribbon-wrapper"><div class="ribbon-red">Most Popular</div></div>`
        : '';

      const baseFeaturesHtml = (baseFeatures[category] || []).map((f, fi) => `
        <li class="flex items-center gap-3">
          <span class="w-5 h-5 rounded-full bg-blue-50 text-primary flex items-center justify-center flex-shrink-0">
            ${featureIcons[fi] || featureIcons[0]}
          </span>
          <span>${f}</span>
        </li>
      `).join('');

      return `
        <div class="pricing-card bg-white rounded-3xl ${borderClass} p-8 flex flex-col justify-between card-hover relative overflow-hidden ${translateClass}" data-plan="${plan.plan}">
          ${ribbonHtml}
          <div>
            <div class="flex items-start justify-between gap-2 mb-2 ${plan.popular ? 'pr-14' : ''}">
              <h3 class="card-plan-title text-xl font-black text-slate-900 leading-tight">${plan.title}</h3>
              ${badgeHtml}
            </div>
            <div class="text-xs text-slate-400 font-medium mt-3">From only</div>
            <div class="mt-1 flex items-baseline gap-1">
              <span class="card-plan-price text-4xl sm:text-5xl font-black text-slate-900">${formattedPrice}</span>
              <span class="card-plan-period text-xs font-semibold text-slate-500">${period}</span>
            </div>
            <p class="card-plan-desc text-xs text-slate-500 mt-4 leading-relaxed">${plan.desc}</p>

            <ul class="mt-6 space-y-3.5 text-xs font-medium text-slate-700">
              ${baseFeaturesHtml}
            </ul>

            <div class="mt-5">
              <button type="button" class="expand-feature-btn flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-primary transition-colors focus:outline-none cursor-pointer">
                <span class="expand-label">&#9662; Expand Feature</span>
              </button>
              <div class="hidden mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl">
                ${((extraFeatures[category] && extraFeatures[category][idx]) || []).map(f => `
                  <div class="flex items-center gap-2">
                    <span class="text-primary font-bold">&check;</span>
                    <span>${f}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="mt-8 pt-4">
            <a href="${ctaHref}" class="card-cta-btn w-full ${ctaClass} font-extrabold py-3.5 px-6 rounded-xl text-center block transition-all">
              Purchase Plan
            </a>
          </div>
        </div>
      `;
    }).join('');

    buildExpandListeners(container);
  }

  function updateAllStaticPrices() {
    const staticEls = document.querySelectorAll('[data-usd]');
    staticEls.forEach(el => {
      const usd = parseFloat(el.getAttribute('data-usd'));
      if (isNaN(usd)) return;
      const prefix = el.getAttribute('data-prefix') || '';
      const suffix = el.getAttribute('data-suffix') || '';
      el.textContent = `${prefix}${formatLandingPrice(usd)}${suffix}`;
    });
    renderPricingCards(currentCategory, isYearly);
    if (lastHeroResults && lastHeroResults.length > 0) {
      renderHeroResults(lastHeroResults);
    }
  }

  const pricingTabBtns = document.querySelectorAll('.pricing-tab-btn');
  pricingTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pricingTabBtns.forEach(b => {
        b.classList.remove('active', 'bg-primary', 'text-white', 'shadow-md');
        b.classList.add('bg-white', 'text-slate-700', 'border', 'border-slate-200');
      });
      btn.classList.add('active', 'bg-primary', 'text-white', 'shadow-md');
      btn.classList.remove('bg-white', 'text-slate-700', 'border', 'border-slate-200');
      currentCategory = btn.getAttribute('data-category') || 'shared';
      renderPricingCards(currentCategory, isYearly);
    });
  });

  if (billingToggle && billingKnob) {
    billingToggle.addEventListener('click', () => {
      isYearly = !isYearly;
      billingToggle.setAttribute('aria-checked', String(isYearly));
      if (isYearly) {
        billingKnob.classList.add('translate-x-6');
        billingKnob.classList.remove('translate-x-0');
        billingToggle.classList.add('bg-primary');
        billingToggle.classList.remove('bg-slate-300');
      } else {
        billingKnob.classList.remove('translate-x-6');
        billingKnob.classList.add('translate-x-0');
        billingToggle.classList.remove('bg-primary');
        billingToggle.classList.add('bg-slate-300');
      }
      renderPricingCards(currentCategory, isYearly);
    });
  }

  const staticExpandBtns = document.querySelectorAll('.expand-feature-btn');
  if (staticExpandBtns.length > 0) {
    buildExpandListeners(document);
  }

  const faqElements = document.querySelectorAll('.faq-toggle, .faq-trigger');
  faqElements.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      const answer = toggle.nextElementSibling;
      const icon = toggle.querySelector('.faq-icon') || toggle.querySelector('span:last-child');

      toggle.setAttribute('aria-expanded', String(!isExpanded));
      if (answer) {
        answer.classList.toggle('hidden');
      }
      if (icon) {
        icon.textContent = isExpanded ? '+' : '\u2212';
        icon.classList.toggle('text-primary');
        icon.classList.toggle('text-slate-400');
      }
    });
  });

  window.addEventListener('currencyChanged', (e) => {
    if (currencySelector && currencySelector.value !== e.detail) {
      currencySelector.value = e.detail;
    }
    updateAllStaticPrices();
  });

  updateAllStaticPrices();
});
