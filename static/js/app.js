document.addEventListener('DOMContentLoaded', () => {
  const rates = { 'USD': 1.0, 'EUR': 0.92, 'GBP': 0.79, 'KES': 130.0 };
  const symbols = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'KES': 'KSh ' };
  const cycleDiscounts = { 1: 0.0, 12: 0.20, 24: 0.30, 36: 0.40 };

  const initialUrlParams = new URLSearchParams(window.location.search);
  const initialDomainParam = initialUrlParams.get('domain');
  const initialPlanParam = initialUrlParams.get('plan');
  const initialTabParam = initialUrlParams.get('tab') || (initialDomainParam ? 'domains' : 'shared');
  const initialStepParam = parseInt(initialUrlParams.get('step') || '1', 10);
  const initialAuthParam = initialUrlParams.get('auth');

  let savedCart = [];
  try {
    savedCart = JSON.parse(localStorage.getItem('cloudoon_cart') || '[]');
  } catch (_e) {
    savedCart = [];
  }

  function getBaseCatalogPlan(planId) {
    const plans = {
      'web-starter': { id: 'web-starter', name: 'Shared Hosting - Web Starter', category: 'shared', monthly_base: 3.60, monthly_renewal: 5.99 },
      'wordpress-pro': { id: 'wordpress-pro', name: 'Shared Hosting - WordPress Pro', category: 'shared', monthly_base: 5.90, monthly_renewal: 9.99 },
      'woocommerce-growth': { id: 'woocommerce-growth', name: 'Shared Hosting - WooCommerce Growth', category: 'shared', monthly_base: 11.90, monthly_renewal: 18.99 }
    };
    return plans[planId] || plans['wordpress-pro'];
  }

  if (initialPlanParam) {
    const initialPlan = getBaseCatalogPlan(initialPlanParam);
    if (!savedCart.some(i => i.id === initialPlan.id)) {
      savedCart.push(initialPlan);
    }
  }

  if (initialDomainParam) {
    const domainItem = {
      id: `domain-${initialDomainParam}`,
      name: `Domain Registration (${initialDomainParam})`,
      category: 'domain',
      monthly_base: 9.99 / 12,
      monthly_renewal: 14.99 / 12,
      is_yearly: true,
      raw_first_year: 9.99,
      raw_renewal: 14.99
    };
    if (!savedCart.some(i => i.id === domainItem.id)) {
      savedCart.push(domainItem);
    }
  }

  let state = {
    step: initialStepParam,
    activeTab: initialTabParam,
    currency: localStorage.getItem('cloudoon_currency') || 'KES',
    billingCycle: 36,
    promoCode: null,
    promoDiscountPct: 0,
    authMode: initialAuthParam === 'login' ? 'login' : 'signup',
    paymentMethod: 'card',
    renewalAcknowledged: false,
    items: savedCart
  };

  let lastDomainSearchResults = [];

  const tabButtons = document.querySelectorAll('.product-tab-btn');
  const tabPanes = document.querySelectorAll('.product-tab-pane');
  const sharedCards = document.querySelectorAll('.shared-plan-card');
  const billingCycleCards = document.querySelectorAll('.billing-cycle-card');
  const stepIndicators = document.querySelectorAll('.step-nav-btn');
  const stepPanels = document.querySelectorAll('.step-panel');
  const backButtons = document.querySelectorAll('.back-to-step-btn');

  const domainSearchInput = document.getElementById('domain-search-input');
  const domainSearchBtn = document.getElementById('domain-search-btn');
  const domainSearchFeedback = document.getElementById('domain-search-feedback');
  const toggleWhois = document.getElementById('toggle-whois');
  const toggleDomainAutorenew = document.getElementById('toggle-domain-autorenew');
  const domainRadios = document.querySelectorAll('input[name="domain-action"]');
  const domainModeRegister = document.getElementById('domain-mode-register');
  const domainModeTransfer = document.getElementById('domain-mode-transfer');
  const domainModeExisting = document.getElementById('domain-mode-existing');
  const transferDomainInput = document.getElementById('transfer-domain-input');
  const transferAuthCode = document.getElementById('transfer-auth-code');
  const transferVerifyBtn = document.getElementById('transfer-verify-btn');
  const transferFeedback = document.getElementById('transfer-feedback');
  const existingDomainInput = document.getElementById('existing-domain-input');
  const existingUseBtn = document.getElementById('existing-use-btn');

  const vpsSliderCpu = document.getElementById('vps-slider-cpu');
  const vpsSliderRam = document.getElementById('vps-slider-ram');
  const vpsSliderStorage = document.getElementById('vps-slider-storage');
  const vpsCpuDisplay = document.getElementById('vps-cpu-display');
  const vpsRamDisplay = document.getElementById('vps-ram-display');
  const vpsStorageDisplay = document.getElementById('vps-storage-display');
  const vpsCpuCost = document.getElementById('vps-cpu-cost');
  const vpsRamCost = document.getElementById('vps-ram-cost');
  const vpsStorageCost = document.getElementById('vps-storage-cost');
  const vpsCalculatedTotal = document.getElementById('vps-calculated-total');
  const vpsManagementToggle = document.getElementById('vps-management-toggle');
  const vpsApplyBtn = document.getElementById('vps-apply-btn');

  const dedicatedSelectBtns = document.querySelectorAll('.dedicated-select-btn');
  const dedicatedDatacenter = document.getElementById('dedicated-datacenter');
  const dedicatedBandwidth = document.getElementById('dedicated-bandwidth');

  const cloudAddBtns = document.querySelectorAll('.cloud-add-btn');
  const cloudK8sToggle = document.getElementById('cloud-k8s-toggle');

  const addonCheckboxes = document.querySelectorAll('.addon-checkbox');

  const cartSkeleton = document.getElementById('cart-skeleton');
  const cartEmptyState = document.getElementById('cart-empty-state');
  const cartContentState = document.getElementById('cart-content-state');
  const cartItemsList = document.getElementById('cart-items-list');
  const cartRecoverBtn = document.getElementById('cart-recover-btn');
  const promoInput = document.getElementById('promo-input');
  const promoApplyBtn = document.getElementById('promo-apply-btn');
  const promoFeedback = document.getElementById('promo-feedback');

  const summarySubtotal = document.getElementById('summary-subtotal');
  const summaryDiscountLabel = document.getElementById('summary-discount-label');
  const summaryDiscountAmt = document.getElementById('summary-discount-amt');
  const summaryPromoRow = document.getElementById('summary-promo-row');
  const summaryPromoLabel = document.getElementById('summary-promo-label');
  const summaryPromoAmt = document.getElementById('summary-promo-amt');
  const summaryTaxLabel = document.getElementById('summary-tax-label');
  const summaryTaxAmt = document.getElementById('summary-tax-amt');
  const summaryTotalDue = document.getElementById('summary-total-due');
  const summaryTotalRenewal = document.getElementById('summary-total-renewal');
  const summaryCurrencyBadge = document.getElementById('summary-currency-badge');
  const mobileDrawerTotal = document.getElementById('mobile-drawer-total');
  const mobileDrawerActionBtn = document.getElementById('mobile-drawer-action-btn');

  const proceedToStep2Btn = document.getElementById('proceed-to-step-2-btn');
  const proceedToStep3Btn = document.getElementById('proceed-to-step-3-btn');
  const authTabSignup = document.getElementById('auth-tab-signup');
  const authTabLogin = document.getElementById('auth-tab-login');
  const signupFields = document.getElementById('signup-fields');
  const loginFields = document.getElementById('login-fields');
  const billingFullname = document.getElementById('billing-fullname');
  const billingEmail = document.getElementById('billing-email');
  const billingPassword = document.getElementById('billing-password');
  const passwordStrengthLabel = document.getElementById('password-strength-label');
  const passwordStrengthScore = document.getElementById('password-strength-score');
  const passwordStrengthBar = document.getElementById('password-strength-bar');
  const billingCountry = document.getElementById('billing-country');
  const billingPhone = document.getElementById('billing-phone');
  const billingAddress = document.getElementById('billing-address');
  const billingCity = document.getElementById('billing-city');
  const billingPostal = document.getElementById('billing-postal');
  const addressAutocompleteDropdown = document.getElementById('address-autocomplete-dropdown');
  const oauthButtons = document.querySelectorAll('.oauth-btn');

  const paymentCards = document.querySelectorAll('.payment-method-card');
  const paymentCardForm = document.getElementById('payment-card-form');
  const paymentMpesaForm = document.getElementById('payment-mpesa-form');
  const paymentPaypalForm = document.getElementById('payment-paypal-form');
  const cardNumberInput = document.getElementById('card-number');
  const cardExpiryInput = document.getElementById('card-expiry');
  const cardCvcInput = document.getElementById('card-cvc');
  const cardNameInput = document.getElementById('card-name');
  const cardBrandBadge = document.getElementById('card-brand-badge');
  const mpesaPhoneInput = document.getElementById('mpesa-phone-input');
  const renewalAcknowledgementCheck = document.getElementById('renewal-acknowledgement-check');
  const ackRenewalRate = document.getElementById('ack-renewal-rate');
  const ackRenewalDate = document.getElementById('ack-renewal-date');
  const payButton = document.getElementById('pay-button');
  const payButtonSpinner = document.getElementById('pay-button-spinner');
  const payButtonText = document.getElementById('pay-button-text');
  const payErrorMsg = document.getElementById('pay-error-msg');

  const confirmationSuccessPanel = document.getElementById('confirmation-success-panel');
  const successReportId = document.getElementById('success-report-id');
  const successCellOrder = document.getElementById('success-cell-order');
  const successCellDate = document.getElementById('success-cell-date');
  const successCellCustomer = document.getElementById('success-cell-customer');
  const successCellPayment = document.getElementById('success-cell-payment');
  const successCellTotal = document.getElementById('success-cell-total');
  const successCellPaid = document.getElementById('success-cell-paid');
  const successCellCurrency = document.getElementById('success-cell-currency');
  const successCellServed = document.getElementById('success-cell-served');
  const successFullInvoiceBtn = document.getElementById('success-full-invoice-btn');

  function getRate() {
    return rates[state.currency] || 130.0;
  }

  function getSym() {
    return symbols[state.currency] || 'KSh ';
  }

  function formatMoney(amountUsd) {
    const val = amountUsd * getRate();
    const sym = getSym();
    if (state.currency === 'KES') {
      return `${sym}${Math.round(val).toLocaleString()}`;
    }
    return `${sym}${val.toFixed(2)}`;
  }

  function activateTab(tabId) {
    state.activeTab = tabId;
    tabButtons.forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('bg-white', isTarget);
      btn.classList.toggle('text-primary', isTarget);
      btn.classList.toggle('shadow-sm', isTarget);
      btn.classList.toggle('text-slate-700', !isTarget);
    });

    tabPanes.forEach(pane => {
      pane.classList.toggle('hidden', pane.id !== `tab-content-${tabId}`);
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      activateTab(btn.getAttribute('data-tab'));
    });
  });

  if (state.activeTab) {
    activateTab(state.activeTab);
  }

  function setStep(newStep) {
    state.step = newStep;
    stepPanels.forEach(p => p.classList.add('hidden'));
    confirmationSuccessPanel.classList.add('hidden');

    const targetPanel = document.getElementById(`step-panel-${newStep}`);
    if (targetPanel) {
      targetPanel.classList.remove('hidden');
    }

    stepIndicators.forEach(ind => {
      const stepNum = parseInt(ind.getAttribute('data-step'), 10);
      const circle = ind.querySelector('span:first-child');
      if (stepNum === newStep) {
        ind.className = 'step-nav-btn flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white border border-primary transition-all cursor-pointer';
        if (circle) circle.className = 'w-5 h-5 rounded-full bg-white text-primary flex items-center justify-center text-[11px] font-bold';
      } else if (stepNum < newStep) {
        ind.className = 'step-nav-btn flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-900/60 text-emerald-300 border border-emerald-700 transition-all cursor-pointer';
        if (circle) circle.className = 'w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[11px] font-bold';
      } else {
        ind.className = 'step-nav-btn flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 transition-all cursor-pointer';
        if (circle) circle.className = 'w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[11px] font-bold';
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  stepIndicators.forEach(ind => {
    ind.addEventListener('click', () => {
      const stepNum = parseInt(ind.getAttribute('data-step'), 10);
      if (stepNum <= state.step || (state.items.length > 0 && stepNum <= 3)) {
        setStep(stepNum);
      }
    });
  });

  backButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.getAttribute('data-target'), 10);
      setStep(target);
    });
  });

  function calculateTotals() {
    let subtotalUsd = 0;
    let renewalTotalUsd = 0;
    const months = state.billingCycle;
    const discountPct = cycleDiscounts[months] || 0.0;

    state.items.forEach(item => {
      if (item.is_yearly) {
        const years = Math.max(1, Math.round(months / 12));
        subtotalUsd += (item.raw_first_year || item.monthly_base * 12) * years;
        renewalTotalUsd += (item.raw_renewal || item.monthly_renewal * 12) * years;
      } else {
        const itemSubtotal = item.monthly_base * months;
        subtotalUsd += itemSubtotal;
        renewalTotalUsd += item.monthly_renewal * months;
      }
    });

    const termDiscountUsd = subtotalUsd * discountPct;
    const afterTermDiscount = subtotalUsd - termDiscountUsd;

    const promoDiscountUsd = afterTermDiscount * (state.promoDiscountPct / 100);
    const afterPromo = afterTermDiscount - promoDiscountUsd;

    const country = billingCountry ? billingCountry.value : 'Kenya';
    const isKes = state.currency === 'KES' || country === 'Kenya';
    const taxRate = isKes ? 0.16 : 0.0;
    const taxUsd = afterPromo * taxRate;

    const totalDueTodayUsd = afterPromo + taxUsd;
    const renewalTaxUsd = renewalTotalUsd * taxRate;
    const renewsAtUsd = renewalTotalUsd + renewalTaxUsd;

    return {
      subtotalUsd,
      discountPct,
      termDiscountUsd,
      promoDiscountUsd,
      taxRate,
      taxUsd,
      totalDueTodayUsd,
      renewsAtUsd,
      months
    };
  }

  function renderSummary() {
    const calc = calculateTotals();
    const sym = getSym();

    localStorage.setItem('cloudoon_cart', JSON.stringify(state.items));
    const navCartCount = document.getElementById('nav-cart-count');
    if (navCartCount) navCartCount.textContent = state.items.length;

    if (summaryCurrencyBadge) {
      summaryCurrencyBadge.textContent = `${state.currency} (${sym.trim()})`;
    }

    const checkoutEmptyView = document.getElementById('checkout-empty-view');
    const checkoutGrid = document.getElementById('checkout-grid');
    const checkoutStepsNav = document.getElementById('checkout-steps-nav');
    const mobileDrawer = document.querySelector('.mobile-drawer');

    if (state.items.length === 0) {
      if (checkoutEmptyView) checkoutEmptyView.classList.remove('hidden');
      if (checkoutGrid) checkoutGrid.classList.add('hidden');
      if (checkoutStepsNav) checkoutStepsNav.classList.add('hidden');
      if (mobileDrawer) mobileDrawer.classList.add('hidden');
      if (cartEmptyState) cartEmptyState.classList.remove('hidden');
      if (cartContentState) cartContentState.classList.add('hidden');
      if (proceedToStep2Btn) proceedToStep2Btn.disabled = true;
      if (mobileDrawerActionBtn) mobileDrawerActionBtn.disabled = true;
      return;
    }

    if (checkoutEmptyView) checkoutEmptyView.classList.add('hidden');
    if (checkoutGrid) checkoutGrid.classList.remove('hidden');
    if (checkoutStepsNav) checkoutStepsNav.classList.remove('hidden');
    if (mobileDrawer) mobileDrawer.classList.remove('hidden');
    if (cartEmptyState) cartEmptyState.classList.add('hidden');
    if (cartContentState) cartContentState.classList.remove('hidden');
    if (proceedToStep2Btn) proceedToStep2Btn.disabled = false;
    if (mobileDrawerActionBtn) mobileDrawerActionBtn.disabled = false;

    cartItemsList.innerHTML = '';
    state.items.forEach((item, idx) => {
      const itemRow = document.createElement('div');
      itemRow.className = 'pt-2 pb-2 flex items-start justify-between gap-2';

      let priceText = '';
      let renewalText = '';
      if (item.is_yearly) {
        priceText = formatMoney(item.raw_first_year || item.monthly_base * 12);
        renewalText = `Renews at ${formatMoney(item.raw_renewal || item.monthly_renewal * 12)}/yr`;
      } else {
        const itemMonthlyWithDiscount = item.monthly_base * (1 - calc.discountPct);
        priceText = formatMoney(itemMonthlyWithDiscount * calc.months);
        renewalText = `Renews at ${formatMoney(item.monthly_renewal)}/mo`;
      }

      itemRow.innerHTML = `
        <div class="flex-grow">
          <div class="text-xs font-bold text-slate-900">${item.name}</div>
          <div class="text-[11px] text-slate-500">${renewalText}</div>
        </div>
        <div class="text-right flex-shrink-0 flex items-center gap-2">
          <span class="text-xs font-extrabold text-slate-900">${priceText}</span>
          <button type="button" class="remove-cart-item text-slate-400 hover:text-rose-600 p-1 rounded focus:outline-none" data-index="${idx}" aria-label="Remove ${item.name}">
            &times;
          </button>
        </div>
      `;
      cartItemsList.appendChild(itemRow);
    });

    document.querySelectorAll('.remove-cart-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        state.items.splice(index, 1);
        renderSummary();
      });
    });

    summarySubtotal.textContent = formatMoney(calc.subtotalUsd);
    summaryDiscountLabel.textContent = `${calc.months}-Month Term Discount (${Math.round(calc.discountPct * 100)}%):`;
    summaryDiscountAmt.textContent = `-${formatMoney(calc.termDiscountUsd)}`;

    if (state.promoCode && state.promoDiscountPct > 0) {
      summaryPromoRow.classList.remove('hidden');
      summaryPromoLabel.textContent = `Promo (${state.promoCode} - ${state.promoDiscountPct}%):`;
      summaryPromoAmt.textContent = `-${formatMoney(calc.promoDiscountUsd)}`;
    } else {
      summaryPromoRow.classList.add('hidden');
    }

    summaryTaxLabel.textContent = `Tax Estimate (${Math.round(calc.taxRate * 100)}%):`;
    summaryTaxAmt.textContent = formatMoney(calc.taxUsd);

    const totalDueFormatted = formatMoney(calc.totalDueTodayUsd);
    summaryTotalDue.textContent = totalDueFormatted;
    summaryTotalRenewal.textContent = formatMoney(calc.renewsAtUsd);
    if (mobileDrawerTotal) mobileDrawerTotal.textContent = totalDueFormatted;

    if (payButtonText) payButtonText.textContent = `Pay ${totalDueFormatted} Now`;
    if (ackRenewalRate) ackRenewalRate.textContent = formatMoney(calc.renewsAtUsd);

    const renewalDateObj = new Date();
    renewalDateObj.setMonth(renewalDateObj.getMonth() + calc.months);
    const dateFormatted = renewalDateObj.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
    if (ackRenewalDate) ackRenewalDate.textContent = dateFormatted;

    updateBillingCycleCards();
    updateConfiguratorPrices();
  }

  function updateConfiguratorPrices() {
    const discountPct = cycleDiscounts[state.billingCycle] || 0.0;
    const pctStr = `${Math.round(discountPct * 100)}% OFF`;

    document.querySelectorAll('.shared-plan-card').forEach(card => {
      const priceDisplay = card.querySelector('.plan-price-display');
      const origPrice = card.querySelector('.plan-orig-price');
      const badge = card.querySelector('.plan-discount-badge');
      const renewalDisplay = card.querySelector('.plan-renewal-display');

      if (priceDisplay) {
        const base = parseFloat(priceDisplay.getAttribute('data-base'));
        const discounted = base * (1 - discountPct);
        priceDisplay.textContent = formatMoney(discounted);
        if (origPrice) {
          origPrice.textContent = formatMoney(base);
          origPrice.classList.toggle('hidden', discountPct === 0);
        }
        if (badge) {
          badge.textContent = pctStr;
          badge.classList.toggle('hidden', discountPct === 0);
        }
      }
      if (renewalDisplay) {
        const renBase = parseFloat(renewalDisplay.getAttribute('data-base'));
        renewalDisplay.textContent = formatMoney(renBase);
      }
    });

    document.querySelectorAll('.dedicated-price-display').forEach(el => {
      const parent = el.closest('.p-5') || el.parentElement;
      const origPrice = parent ? parent.querySelector('.dedicated-orig-price') : null;
      const badge = parent ? parent.querySelector('.dedicated-discount-badge') : null;
      const base = parseFloat(el.getAttribute('data-base'));
      const discounted = base * (1 - discountPct);
      el.textContent = formatMoney(discounted);
      if (origPrice) {
        origPrice.textContent = formatMoney(base);
        origPrice.classList.toggle('hidden', discountPct === 0);
      }
      if (badge) {
        badge.textContent = pctStr;
        badge.classList.toggle('hidden', discountPct === 0);
      }
    });

    document.querySelectorAll('.cloud-price-display').forEach(el => {
      const parent = el.closest('label') || el.parentElement;
      const origPrice = parent ? parent.querySelector('.cloud-orig-price') : null;
      const badge = parent ? parent.querySelector('.cloud-discount-badge') : null;
      const base = parseFloat(el.getAttribute('data-base'));
      const discounted = base * (1 - discountPct);
      el.textContent = formatMoney(discounted);
      if (origPrice) {
        origPrice.textContent = formatMoney(base);
        origPrice.classList.toggle('hidden', discountPct === 0);
      }
      if (badge) {
        badge.textContent = pctStr;
        badge.classList.toggle('hidden', discountPct === 0);
      }
    });

    const k8sEl = document.getElementById('cloud-k8s-cost');
    if (k8sEl) {
      const k8sBase = parseFloat(k8sEl.getAttribute('data-base') || '45.00');
      k8sEl.textContent = `+${formatMoney(k8sBase)}/mo`;
    }

    const whoisEl = document.getElementById('whois-cost-display');
    if (whoisEl) {
      const whoisBase = parseFloat(whoisEl.getAttribute('data-base') || '1.99');
      whoisEl.textContent = `${formatMoney(whoisBase)}/yr`;
    }

    if (dedicatedBandwidth) {
      Array.from(dedicatedBandwidth.options).forEach(opt => {
        const base = parseFloat(opt.getAttribute('data-base') || '0');
        if (base > 0) {
          if (opt.value === 'unmetered-1g') {
            opt.textContent = `Unmetered 1 Gbps Dedicated (+${formatMoney(base)}/mo)`;
          } else if (opt.value === 'unmetered-10g') {
            opt.textContent = `Unmetered 10 Gbps Burst Uplink (+${formatMoney(base)}/mo)`;
          }
        }
      });
    }

    document.querySelectorAll('.addon-price-display').forEach(el => {
      const parent = el.closest('label') || el.parentElement;
      const origPrice = parent ? parent.querySelector('.addon-orig-price') : null;
      const badge = parent ? parent.querySelector('.addon-discount-badge') : null;
      const base = parseFloat(el.getAttribute('data-base'));
      const discounted = base * (1 - discountPct);
      el.textContent = formatMoney(discounted);
      if (origPrice) {
        origPrice.textContent = formatMoney(base);
        origPrice.classList.toggle('hidden', discountPct === 0);
      }
      if (badge) {
        badge.textContent = pctStr;
        badge.classList.toggle('hidden', discountPct === 0);
      }
    });

    updateVpsCalculations();
    if (lastDomainSearchResults && lastDomainSearchResults.length > 0) {
      renderDomainSearchResults(lastDomainSearchResults);
    }
  }

  function updateBillingCycleCards() {
    billingCycleCards.forEach(card => {
      const months = parseInt(card.getAttribute('data-months'), 10);
      const discountPct = cycleDiscounts[months] || 0.0;
      const dot = card.querySelector('.cycle-radio-dot');
      const isSelected = state.billingCycle === months;

      card.classList.toggle('border-primary', isSelected);
      card.classList.toggle('bg-primary-light/30', isSelected);
      card.classList.toggle('border-slate-200', !isSelected);

      if (dot) {
        if (isSelected) {
          dot.className = 'cycle-radio-dot w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[10px] text-white';
          dot.innerHTML = '&check;';
        } else {
          dot.className = 'cycle-radio-dot w-4 h-4 rounded-full border border-slate-300';
          dot.innerHTML = '';
        }
      }

      const discountDisplay = card.querySelector('.cycle-discount-display');
      if (discountDisplay) {
        const pctStr = discountPct > 0 ? `${Math.round(discountPct * 100)}% off selected items` : 'Standard rate on all items';
        discountDisplay.textContent = pctStr;
      }
    });

    const billingCycleDropdown = document.getElementById('billing-cycle-dropdown');
    if (billingCycleDropdown) {
      billingCycleDropdown.value = String(state.billingCycle);
    }
  }

  const billingCycleDropdown = document.getElementById('billing-cycle-dropdown');
  if (billingCycleDropdown) {
    billingCycleDropdown.addEventListener('change', (e) => {
      state.billingCycle = parseInt(e.target.value, 10);
      renderSummary();
    });
  }

  const quickPlanDropdown = document.getElementById('quick-plan-dropdown');
  if (quickPlanDropdown) {
    quickPlanDropdown.addEventListener('change', (e) => {
      const val = e.target.value;
      if (['web-starter', 'wordpress-pro', 'woocommerce-growth'].includes(val)) {
        activateTab('shared');
        const input = document.querySelector(`input[name="shared-plan"][value="${val}"]`);
        if (input) {
          const card = input.closest('.shared-plan-card');
          if (card) card.click();
        }
      } else if (val === 'vps-custom') {
        activateTab('vps');
        if (vpsApplyBtn) vpsApplyBtn.click();
      } else if (val.startsWith('intel-') || val.startsWith('amd-') || val.startsWith('dual-')) {
        activateTab('dedicated');
        const btn = document.querySelector(`.dedicated-select-btn[data-id="${val}"]`);
        if (btn) btn.click();
      } else if (val.startsWith('cloud-')) {
        activateTab('cloud');
        const btn = document.querySelector(`.cloud-add-btn[data-id="${val}"]`);
        if (btn) btn.click();
      }
    });
  }

  billingCycleCards.forEach(card => {
    card.addEventListener('click', () => {
      const months = parseInt(card.getAttribute('data-months'), 10);
      state.billingCycle = months;
      renderSummary();
    });
  });

  sharedCards.forEach(card => {
    card.addEventListener('click', () => {
      sharedCards.forEach(c => {
        c.classList.remove('border-primary', 'bg-primary-light/30');
        c.classList.add('border-slate-200');
        const check = c.querySelector('.plan-check');
        if (check) {
          check.className = 'plan-check w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-white';
          check.innerHTML = '';
        }
      });

      card.classList.add('border-primary', 'bg-primary-light/30');
      card.classList.remove('border-slate-200');
      const check = card.querySelector('.plan-check');
      if (check) {
        check.className = 'plan-check w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]';
        check.innerHTML = '&check;';
      }

      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        state.items = state.items.filter(i => i.category !== 'shared' && i.category !== 'vps');
        state.items.unshift(getBaseCatalogPlan(radio.value));
        renderSummary();
      }
    });
  });

  if (cartRecoverBtn) {
    cartRecoverBtn.addEventListener('click', () => {
      state.items.push(getBaseCatalogPlan('wordpress-pro'));
      renderSummary();
    });
  }

  const emptyAddRecommendedBtn = document.getElementById('empty-add-recommended-btn');
  if (emptyAddRecommendedBtn) {
    emptyAddRecommendedBtn.addEventListener('click', () => {
      state.items.push(getBaseCatalogPlan('wordpress-pro'));
      renderSummary();
    });
  }

  const emptyOpenConfiguratorBtn = document.getElementById('empty-open-configurator-btn');
  if (emptyOpenConfiguratorBtn) {
    emptyOpenConfiguratorBtn.addEventListener('click', () => {
      state.items.push(getBaseCatalogPlan('wordpress-pro'));
      renderSummary();
    });
  }

  domainRadios.forEach(r => {
    r.addEventListener('change', (e) => {
      const val = e.target.value;
      domainModeRegister.classList.toggle('hidden', val !== 'register');
      domainModeTransfer.classList.toggle('hidden', val !== 'transfer');
      domainModeExisting.classList.toggle('hidden', val !== 'existing');
    });
  });

  async function performDomainSearch(query) {
    if (!query) return;
    domainSearchFeedback.innerHTML = `
      <div class="flex items-center gap-2 text-xs text-slate-500 py-3">
        <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span>Checking TLD registers for "${query}"...</span>
      </div>
    `;

    try {
      const res = await fetch(`/api/domains/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.status === 'success') {
        renderDomainSearchResults(json.data.results);
      } else {
        domainSearchFeedback.innerHTML = `<div class="p-3 text-xs text-rose-600 bg-rose-50 rounded-xl">Error checking domain availability.</div>`;
      }
    } catch {
      domainSearchFeedback.innerHTML = `<div class="p-3 text-xs text-rose-600 bg-rose-50 rounded-xl">Network error verifying domain.</div>`;
    }
  }

  function renderDomainSearchResults(results) {
    lastDomainSearchResults = results || [];
    let html = `<div class="space-y-2 mt-2">`;
    results.slice(0, 4).forEach(item => {
      const firstYearFmt = formatMoney(item.first_year);
      const renewalFmt = formatMoney(item.renewal);
      const isAlreadyInCart = state.items.some(i => i.id === `domain-${item.domain}`);

      html += `
        <div class="flex items-center justify-between p-3 rounded-xl border ${item.available ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50'}">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full ${item.available ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
            <div>
              <div class="text-xs font-bold text-slate-900">${item.domain}</div>
              <div class="text-[10px] text-slate-500">
                ${item.available ? `Renews at ${renewalFmt}/yr` : 'Taken'}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            ${item.available ? `
              <div class="text-right">
                <div class="text-xs font-extrabold text-slate-900">${firstYearFmt}</div>
                <div class="text-[9px] text-emerald-700 uppercase font-semibold">1st Year</div>
              </div>
              <button type="button" class="domain-add-btn ${isAlreadyInCart ? 'btn-outline' : 'btn-accent'} text-[11px] py-1.5 px-3" data-domain="${item.domain}" data-first="${item.first_year}" data-renewal="${item.renewal}">
                ${isAlreadyInCart ? 'Added &check;' : 'Add to Cart'}
              </button>
            ` : `
              <span class="text-[11px] text-slate-400 font-semibold">Unavailable</span>
            `}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    domainSearchFeedback.innerHTML = html;

    document.querySelectorAll('.domain-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const domain = e.currentTarget.getAttribute('data-domain');
        const first = parseFloat(e.currentTarget.getAttribute('data-first'));
        const renewal = parseFloat(e.currentTarget.getAttribute('data-renewal'));

        state.items = state.items.filter(i => i.category !== 'domain');
        state.items.push({
          id: `domain-${domain}`,
          name: `Domain Registration (${domain})`,
          category: 'domain',
          monthly_base: first / 12,
          monthly_renewal: renewal / 12,
          is_yearly: true,
          raw_first_year: first,
          raw_renewal: renewal
        });
        renderSummary();
        performDomainSearch(domain);
      });
    });
  }

  if (domainSearchBtn && domainSearchInput) {
    domainSearchBtn.addEventListener('click', () => {
      performDomainSearch(domainSearchInput.value.trim());
    });
    domainSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performDomainSearch(domainSearchInput.value.trim());
      }
    });
  }

  if (initialDomainParam && domainSearchInput) {
    performDomainSearch(initialDomainParam);
  }

  if (transferVerifyBtn && transferDomainInput && transferAuthCode) {
    transferVerifyBtn.addEventListener('click', async () => {
      const domain = transferDomainInput.value.trim();
      const code = transferAuthCode.value.trim();
      if (!domain || !code) {
        transferFeedback.innerHTML = `<span class="text-rose-600">Please provide both domain and authorization code.</span>`;
        return;
      }
      transferFeedback.innerHTML = `<span class="text-slate-500">Checking registry EPP authorization...</span>`;
      try {
        const res = await fetch('/api/domains/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain, auth_code: code })
        });
        const json = await res.json();
        if (json.status === 'success') {
          transferFeedback.innerHTML = `<span class="text-emerald-600 font-bold">${json.data.message}</span>`;
          state.items = state.items.filter(i => i.category !== 'domain');
          state.items.push({
            id: `transfer-${domain}`,
            name: `Domain Transfer (${domain})`,
            category: 'domain',
            monthly_base: json.data.first_year / 12,
            monthly_renewal: json.data.renewal / 12,
            is_yearly: true,
            raw_first_year: json.data.first_year,
            raw_renewal: json.data.renewal
          });
          renderSummary();
        } else {
          transferFeedback.innerHTML = `<span class="text-rose-600">${json.data.message}</span>`;
        }
      } catch {
        transferFeedback.innerHTML = `<span class="text-rose-600">Verification service unreachable.</span>`;
      }
    });
  }

  if (existingUseBtn && existingDomainInput) {
    existingUseBtn.addEventListener('click', () => {
      const domain = existingDomainInput.value.trim();
      if (!domain) return;
      state.items = state.items.filter(i => i.category !== 'domain');
      state.items.push({
        id: `existing-${domain}`,
        name: `External Domain DNS (${domain})`,
        category: 'domain',
        monthly_base: 0,
        monthly_renewal: 0,
        is_yearly: true,
        raw_first_year: 0,
        raw_renewal: 0
      });
      renderSummary();
      alert(`Domain "${domain}" attached with DNS nameservers ns1.cloudoon.com.`);
    });
  }

  if (toggleWhois) {
    toggleWhois.checked = state.items.some(i => i.id === 'whois-privacy');
    toggleWhois.addEventListener('change', (e) => {
      state.items = state.items.filter(i => i.id !== 'whois-privacy');
      if (e.target.checked) {
        state.items.push({
          id: 'whois-privacy',
          name: 'WHOIS Privacy Protection',
          category: 'domain_addon',
          monthly_base: 1.99 / 12,
          monthly_renewal: 1.99 / 12,
          is_yearly: true,
          raw_first_year: 1.99,
          raw_renewal: 1.99
        });
      }
      renderSummary();
    });
  }

  function updateVpsCalculations() {
    if (!vpsSliderCpu || !vpsSliderRam || !vpsSliderStorage) return;
    const cpu = parseInt(vpsSliderCpu.value, 10);
    const ram = parseInt(vpsSliderRam.value, 10);
    const storage = parseInt(vpsSliderStorage.value, 10);
    const isManaged = vpsManagementToggle ? vpsManagementToggle.checked : false;

    const cpuPrice = cpu * 4.00;
    const ramPrice = (ram / 2) * 5.00;
    const storagePrice = (storage / 20) * 2.00;
    const basePrice = 19.90;
    const managedCost = isManaged ? 15.00 : 0.00;
    const total = basePrice + cpuPrice + ramPrice + storagePrice + managedCost;

    const discountPct = cycleDiscounts[state.billingCycle] || 0.0;
    const discountedTotal = total * (1 - discountPct);

    if (vpsCpuDisplay) vpsCpuDisplay.textContent = `${cpu} vCPU Cores`;
    if (vpsCpuCost) vpsCpuCost.textContent = `${formatMoney(cpuPrice)}/mo`;

    if (vpsRamDisplay) vpsRamDisplay.textContent = `${ram} GB RAM`;
    if (vpsRamCost) vpsRamCost.textContent = `${formatMoney(ramPrice)}/mo`;

    if (vpsStorageDisplay) vpsStorageDisplay.textContent = `${storage} GB NVMe`;
    if (vpsStorageCost) vpsStorageCost.textContent = `${formatMoney(storagePrice)}/mo`;

    if (vpsCalculatedTotal) {
      vpsCalculatedTotal.textContent = `${formatMoney(discountedTotal)}/mo`;
    }

    const vpsOrig = document.querySelector('.vps-orig-price');
    const vpsBadge = document.querySelector('.vps-discount-badge');
    if (vpsOrig) {
      vpsOrig.textContent = formatMoney(total);
      vpsOrig.classList.toggle('hidden', discountPct === 0);
    }
    if (vpsBadge) {
      vpsBadge.textContent = `${Math.round(discountPct * 100)}% OFF`;
      vpsBadge.classList.toggle('hidden', discountPct === 0);
    }

    const managedDisplay = document.getElementById('vps-managed-cost-display');
    if (managedDisplay) {
      managedDisplay.textContent = `Fully Managed (+${formatMoney(15.00)}/mo)`;
    }
  }

  if (vpsSliderCpu && vpsSliderRam && vpsSliderStorage) {
    vpsSliderCpu.addEventListener('input', updateVpsCalculations);
    vpsSliderRam.addEventListener('input', updateVpsCalculations);
    vpsSliderStorage.addEventListener('input', updateVpsCalculations);
    vpsManagementToggle.addEventListener('change', updateVpsCalculations);

    vpsApplyBtn.addEventListener('click', () => {
      const cpu = parseInt(vpsSliderCpu.value, 10);
      const ram = parseInt(vpsSliderRam.value, 10);
      const storage = parseInt(vpsSliderStorage.value, 10);
      const isManaged = vpsManagementToggle.checked;
      const osRadio = document.querySelector('input[name="vps-os"]:checked');
      const os = osRadio ? osRadio.value : 'Ubuntu 24.04';

      const cpuPrice = cpu * 4.00;
      const ramPrice = (ram / 2) * 5.00;
      const storagePrice = (storage / 20) * 2.00;
      const basePrice = 19.90;
      const managedCost = isManaged ? 15.00 : 0.00;
      const total = basePrice + cpuPrice + ramPrice + storagePrice + managedCost;

      state.items = state.items.filter(i => i.category !== 'shared' && i.category !== 'vps');
      state.items.unshift({
        id: 'custom-vps',
        name: `VPS Cloud (${cpu} vCPU, ${ram}GB, ${storage}GB NVMe, ${os})`,
        category: 'vps',
        monthly_base: total,
        monthly_renewal: total + 10.00
      });
      renderSummary();
    });
    updateVpsCalculations();
  }

  dedicatedSelectBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const name = e.currentTarget.getAttribute('data-name');
      const price = parseFloat(e.currentTarget.getAttribute('data-price'));
      const dc = dedicatedDatacenter.options[dedicatedDatacenter.selectedIndex].text;

      state.items = state.items.filter(i => i.category !== 'dedicated');
      state.items.push({
        id: `dedicated-${id}`,
        name: `${name} [${dc}]`,
        category: 'dedicated',
        monthly_base: price,
        monthly_renewal: price + 30.00
      });
      renderSummary();
    });
  });

  cloudAddBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const name = e.currentTarget.getAttribute('data-name');
      const price = parseFloat(e.currentTarget.getAttribute('data-price'));
      const k8s = cloudK8sToggle.checked ? ' + Managed K8s' : '';
      const finalPrice = price + (cloudK8sToggle.checked ? 45.00 : 0.00);

      state.items = state.items.filter(i => i.category !== 'cloud');
      state.items.push({
        id: `cloud-${id}`,
        name: `${name}${k8s}`,
        category: 'cloud',
        monthly_base: finalPrice,
        monthly_renewal: finalPrice + 10.00
      });
      renderSummary();
    });
  });

  addonCheckboxes.forEach(box => {
    box.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const name = e.target.getAttribute('data-name');
      const price = parseFloat(e.target.getAttribute('data-price'));

      state.items = state.items.filter(i => i.id !== `addon-${id}`);
      if (e.target.checked) {
        state.items.push({
          id: `addon-${id}`,
          name: name,
          category: 'addon',
          monthly_base: price,
          monthly_renewal: price
        });
      }
      renderSummary();
    });
  });

  if (promoApplyBtn && promoInput) {
    promoApplyBtn.addEventListener('click', async () => {
      const code = promoInput.value.trim().toUpperCase();
      if (!code) return;
      try {
        const res = await fetch('/api/promo/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        const json = await res.json();
        if (json.status === 'success') {
          state.promoCode = json.data.code;
          state.promoDiscountPct = json.data.discount_pct;
          promoFeedback.innerHTML = `<span class="text-emerald-600 font-bold">&check; ${json.data.description} (${json.data.discount_pct}% Off applied)</span>`;
        } else {
          state.promoCode = null;
          state.promoDiscountPct = 0;
          promoFeedback.innerHTML = `<span class="text-rose-600 font-medium">${json.data.message}</span>`;
        }
      } catch {
        promoFeedback.innerHTML = `<span class="text-rose-600 font-medium">Promo validation failed.</span>`;
      }
      renderSummary();
    });
  }

  function simulateSkeletonRecalculation() {
    cartSkeleton.classList.remove('hidden');
    cartContentState.classList.add('opacity-40');
    setTimeout(() => {
      cartSkeleton.classList.add('hidden');
      cartContentState.classList.remove('opacity-40');
      renderSummary();
    }, 350);
  }

  window.addEventListener('currencyChanged', (e) => {
    state.currency = e.detail;
    updateConfiguratorPrices();
    simulateSkeletonRecalculation();
  });

  const currencySelector = document.getElementById('currency-selector');
  if (currencySelector) {
    currencySelector.value = state.currency;
    currencySelector.addEventListener('change', (e) => {
      state.currency = e.target.value;
      localStorage.setItem('cloudoon_currency', e.target.value);
      window.dispatchEvent(new CustomEvent('currencyChanged', { detail: e.target.value }));
    });
  }

  if (proceedToStep2Btn) {
    proceedToStep2Btn.addEventListener('click', () => {
      if (state.items.length === 0) {
        alert('Please add at least one hosting plan or domain name to proceed.');
        return;
      }
      setStep(2);
    });
  }

  if (mobileDrawerActionBtn) {
    mobileDrawerActionBtn.addEventListener('click', () => {
      if (state.step === 1) {
        if (state.items.length === 0) {
          alert('Please add at least one hosting plan or domain name to proceed.');
          return;
        }
        setStep(2);
      } else if (state.step === 2) {
        validateAndProceedToStep3();
      } else if (state.step === 3) {
        payButton.click();
      }
    });
  }

  if (authTabSignup && authTabLogin) {
    authTabSignup.addEventListener('click', () => {
      state.authMode = 'signup';
      authTabSignup.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-sm transition-all';
      authTabLogin.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition-all';
      signupFields.classList.remove('hidden');
      loginFields.classList.add('hidden');
    });

    authTabLogin.addEventListener('click', () => {
      state.authMode = 'login';
      authTabLogin.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-sm transition-all';
      authTabSignup.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition-all';
      signupFields.classList.add('hidden');
      loginFields.classList.remove('hidden');
    });
  }

  if (billingPassword) {
    billingPassword.addEventListener('input', async (e) => {
      const pwd = e.target.value;
      try {
        const res = await fetch('/api/auth/password-strength', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const json = await res.json();
        if (json.status === 'success') {
          const score = json.data.score;
          passwordStrengthScore.textContent = `${score} / 5`;
          passwordStrengthLabel.textContent = json.data.level;
          const colors = ['bg-rose-500', 'bg-rose-400', 'bg-amber-500', 'bg-primary', 'bg-emerald-500', 'bg-emerald-600'];
          passwordStrengthBar.className = `h-full ${colors[score] || 'bg-slate-300'} transition-all`;
          passwordStrengthBar.style.width = `${(score / 5) * 100}%`;
        }
      } catch {}
    });
  }

  if (billingAddress && addressAutocompleteDropdown) {
    billingAddress.addEventListener('input', async (e) => {
      const q = e.target.value.trim();
      if (q.length < 2) {
        addressAutocompleteDropdown.classList.add('hidden');
        return;
      }
      try {
        const res = await fetch(`/api/auth/address-search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (json.status === 'success' && json.data.length > 0) {
          addressAutocompleteDropdown.innerHTML = '';
          json.data.forEach(item => {
            const row = document.createElement('div');
            row.className = 'px-4 py-2 hover:bg-slate-100 cursor-pointer text-xs border-b border-slate-100 last:border-none';
            row.textContent = `${item.street}, ${item.city}, ${item.country}`;
            row.addEventListener('click', () => {
              billingAddress.value = item.street;
              if (billingCity) billingCity.value = item.city;
              if (billingPostal) billingPostal.value = item.postal;
              if (billingCountry) billingCountry.value = item.country;
              addressAutocompleteDropdown.classList.add('hidden');
              renderSummary();
            });
            addressAutocompleteDropdown.appendChild(row);
          });
          addressAutocompleteDropdown.classList.remove('hidden');
        } else {
          addressAutocompleteDropdown.classList.add('hidden');
        }
      } catch {
        addressAutocompleteDropdown.classList.add('hidden');
      }
    });

    document.addEventListener('click', (e) => {
      if (!billingAddress.contains(e.target) && !addressAutocompleteDropdown.contains(e.target)) {
        addressAutocompleteDropdown.classList.add('hidden');
      }
    });
  }

  oauthButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const provider = btn.getAttribute('data-provider');
      try {
        const res = await fetch(`/api/auth/oauth/${provider}?next=/checkout%3Fstep%3D2`, { method: 'POST' });
        const json = await res.json();
        if (json.status === 'success') {
          if (json.data && json.data.auth_url) {
            window.location.href = json.data.auth_url;
            return;
          }
          if (billingFullname && json.data.user) billingFullname.value = json.data.user.name;
          if (billingEmail && json.data.user) billingEmail.value = json.data.user.email;
          btn.classList.add('border-emerald-500', 'bg-emerald-50');
          setTimeout(() => setStep(3), 400);
        }
      } catch {
        window.location.href = `/auth/login/${provider}?next=/checkout%3Fstep%3D2`;
      }
    });
  });

  if (billingCountry) {
    billingCountry.addEventListener('change', () => {
      renderSummary();
    });
  }

  async function validateAndProceedToStep3() {
    const loggedInBanner = document.getElementById('logged-in-user-banner');
    const isLoggedIn = !!loggedInBanner;

    if (!isLoggedIn) {
      if (state.authMode === 'signup') {
        if (!billingFullname || !billingFullname.value.trim()) {
          if (billingFullname) billingFullname.focus();
          return;
        }
        if (!billingEmail || !billingEmail.value.trim() || !billingEmail.value.includes('@')) {
          if (billingEmail) billingEmail.focus();
          return;
        }
        if (!billingPassword || !billingPassword.value.trim()) {
          if (billingPassword) billingPassword.focus();
          return;
        }

        try {
          await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: billingEmail.value.trim(),
              full_name: billingFullname.value.trim(),
              phone: billingPhone ? billingPhone.value.trim() : '',
              password: billingPassword.value.trim(),
              country: billingCountry ? billingCountry.value : 'Kenya',
              address: billingAddress ? billingAddress.value.trim() : '',
              city: billingCity ? billingCity.value.trim() : '',
              postal: billingPostal ? billingPostal.value.trim() : ''
            })
          });
        } catch {}
      } else {
        const loginEmailInput = document.getElementById('login-email');
        const loginPasswordInput = document.getElementById('login-password');
        if (loginEmailInput && loginPasswordInput) {
          if (!loginEmailInput.value.trim()) {
            loginEmailInput.focus();
            return;
          }
          try {
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: loginEmailInput.value.trim(),
                password: loginPasswordInput.value.trim()
              })
            });
            const json = await res.json();
            if (json.status !== 'success') {
              alert(json.message || 'Login failed.');
              return;
            }
          } catch {}
        }
      }
    }

    if (billingAddress && !billingAddress.value.trim()) {
      billingAddress.focus();
      return;
    }
    setStep(3);
  }

  if (proceedToStep3Btn) {
    proceedToStep3Btn.addEventListener('click', validateAndProceedToStep3);
  }

  paymentCards.forEach(card => {
    card.addEventListener('click', () => {
      paymentCards.forEach(c => {
        c.classList.remove('border-primary', 'bg-primary-light/30');
        c.classList.add('border-slate-200');
        const check = c.querySelector('.pay-method-check');
        if (check) {
          check.className = 'pay-method-check w-4 h-4 rounded-full border border-slate-300';
          check.innerHTML = '';
        }
      });

      card.classList.add('border-primary', 'bg-primary-light/30');
      card.classList.remove('border-slate-200');
      const check = card.querySelector('.pay-method-check');
      if (check) {
        check.className = 'pay-method-check w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px]';
        check.innerHTML = '&check;';
      }

      const method = card.getAttribute('data-method');
      state.paymentMethod = method;

      paymentCardForm.classList.toggle('hidden', method !== 'card');
      paymentMpesaForm.classList.toggle('hidden', method !== 'mpesa');
      paymentPaypalForm.classList.toggle('hidden', method !== 'paypal');
    });
  });

  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').substring(0, 16);
      let formatted = v.match(/.{1,4}/g)?.join(' ') || v;
      e.target.value = formatted;

      if (cardBrandBadge) {
        if (v.startsWith('4')) cardBrandBadge.textContent = 'VISA';
        else if (v.startsWith('5')) cardBrandBadge.textContent = 'MC';
        else if (v.startsWith('3')) cardBrandBadge.textContent = 'AMEX';
        else cardBrandBadge.textContent = 'CARD';
      }
    });
  }

  if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').substring(0, 4);
      if (v.length >= 2) {
        e.target.value = `${v.substring(0, 2)}/${v.substring(2)}`;
      } else {
        e.target.value = v;
      }
    });
  }

  if (renewalAcknowledgementCheck) {
    renewalAcknowledgementCheck.addEventListener('change', (e) => {
      state.renewalAcknowledged = e.target.checked;
      if (payErrorMsg) payErrorMsg.classList.add('hidden');
    });
  }

  if (payButton) {
    payButton.addEventListener('click', async () => {
      if (!renewalAcknowledgementCheck.checked) {
        payErrorMsg.textContent = 'Please confirm the transparent renewal terms acknowledgement before submitting payment.';
        payErrorMsg.classList.remove('hidden');
        renewalAcknowledgementCheck.focus();
        return;
      }

      payButton.disabled = true;
      payButtonSpinner.classList.remove('hidden');
      payButtonText.textContent = 'Processing Order & Provisioning Server...';
      payErrorMsg.classList.add('hidden');

      const calc = calculateTotals();
      const loggedInBanner = document.getElementById('logged-in-user-banner');
      let emailVal = '';
      let nameVal = '';
      if (loggedInBanner) {
        emailVal = loggedInBanner.getAttribute('data-email') || '';
        nameVal = loggedInBanner.getAttribute('data-name') || '';
      }
      if (!emailVal) {
        const loginEmailInput = document.getElementById('login-email');
        emailVal = state.authMode === 'login' && loginEmailInput && loginEmailInput.value
          ? loginEmailInput.value.trim()
          : (billingEmail ? billingEmail.value.trim() : 'customer@cloudoon.com');
      }
      if (!nameVal) {
        nameVal = billingFullname && billingFullname.value.trim() ? billingFullname.value.trim() : 'Walk-in Customer';
      }

      const payload = {
        customer_name: nameVal,
        customer_email: emailVal,
        customer_phone: billingPhone ? billingPhone.value.trim() : (mpesaPhoneInput ? mpesaPhoneInput.value.trim() : '0718080850'),
        customer_country: billingCountry ? billingCountry.value : 'Kenya',
        customer_address: billingAddress ? billingAddress.value.trim() : 'Nairobi',
        billing_cycle: state.billingCycle,
        currency: state.currency,
        currency_symbol: getSym(),
        items: state.items,
        subtotal: calc.subtotalUsd,
        discount: calc.termDiscountUsd + calc.promoDiscountUsd,
        promo_code: state.promoCode || '',
        tax: calc.taxUsd,
        total_due_today: calc.totalDueTodayUsd,
        paid_amount: calc.totalDueTodayUsd,
        balance: 0.0,
        sale_type: 'cash',
        served_by: 'Gid',
        renews_at_total: calc.renewsAtUsd,
        payment_method: state.paymentMethod,
        payment_details: {
          phone: mpesaPhoneInput ? mpesaPhoneInput.value : '',
          card_last4: cardNumberInput ? cardNumberInput.value.slice(-4) : '4242'
        }
      };

      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.status === 'success') {
          showConfirmationSuccess(json.data);
        } else {
          payButton.disabled = false;
          payButtonSpinner.classList.add('hidden');
          payButtonText.textContent = `Pay ${formatMoney(calc.totalDueTodayUsd)} Now`;
          payErrorMsg.textContent = 'Payment processing encountered an error. Please retry.';
          payErrorMsg.classList.remove('hidden');
        }
      } catch (err) {
        payButton.disabled = false;
        payButtonSpinner.classList.add('hidden');
        payButtonText.textContent = `Pay ${formatMoney(calc.totalDueTodayUsd)} Now`;
        payErrorMsg.textContent = 'Server communication error during checkout.';
        payErrorMsg.classList.remove('hidden');
      }
    });
  }

  function showConfirmationSuccess(order) {
    stepPanels.forEach(p => p.classList.add('hidden'));
    const sidebar = document.querySelector('aside.sticky-summary');
    if (sidebar) sidebar.classList.add('hidden');
    const drawer = document.querySelector('.mobile-drawer');
    if (drawer) drawer.classList.add('hidden');

    confirmationSuccessPanel.classList.remove('hidden');

    if (successCellOrder) successCellOrder.textContent = order.order_number;
    if (successCellDate) {
      const raw = String(order.created_at || '').split(' at ')[0].split('T')[0].split(' ')[0];
      successCellDate.textContent = raw || 'Today';
    }
    if (successCellCustomer) successCellCustomer.textContent = order.customer_name || (order.customer && order.customer.name) || 'Walk-in Customer';
    if (successCellPayment) successCellPayment.textContent = order.payment_method || (order.payment && order.payment.method) || 'M-Pesa';
    if (successCellTotal) successCellTotal.textContent = Number(order.total_due_today).toFixed(2);
    if (successCellPaid) successCellPaid.textContent = Number(order.paid_amount || order.total_due_today).toFixed(2);
    if (successFullInvoiceBtn) successFullInvoiceBtn.href = `/invoice/${order.order_number}`;

    localStorage.removeItem('cloudoon_cart');
    const navCartCount = document.getElementById('nav-cart-count');
    if (navCartCount) navCartCount.textContent = '0';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderSummary();
});
