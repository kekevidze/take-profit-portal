/**
 * login.js
 * Front-end logic for Secure Portal Authentication.
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const rememberMeInput = document.getElementById('rememberMe');
  const alertEl = document.getElementById('login-alert');
  const submitBtn = document.getElementById('submit-btn');
  const forgotPassBtn = document.getElementById('forgot-pass-btn');

  // Input Focus animations
  const inputs = [emailInput, passwordInput];
  inputs.forEach(input => {
    const parent = input.closest('.floating-group');
    if (!parent) return;

    input.addEventListener('focus', () => {
      parent.classList.add('focused');
      parent.classList.remove('has-error');
      alertEl.classList.add('hidden');
    });

    input.addEventListener('blur', () => {
      parent.classList.remove('focused');
      if (input.value.trim() !== '') {
        parent.classList.add('has-value');
      } else {
        parent.classList.remove('has-value');
      }
    });

    // Handle pre-filled inputs
    if (input.value.trim() !== '') {
      parent.classList.add('has-value');
    }
  });

  // Forgot password handler
  if (forgotPassBtn) {
    forgotPassBtn.addEventListener('click', () => {
      alertEl.textContent = 'Please contact your supervisor or security admin to reset your credentials.';
      alertEl.className = 'text-primary';
      alertEl.classList.remove('hidden');
    });
  }

  // Handle form submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const rememberMe = rememberMeInput.checked;

    let hasError = false;

    // Email validation
    const emailParent = emailInput.closest('.floating-group');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (emailParent) emailParent.classList.add('has-error');
      hasError = true;
    }

    // Password validation
    const passwordParent = passwordInput.closest('.floating-group');
    if (!password || password.length < 6) {
      if (passwordParent) passwordParent.classList.add('has-error');
      hasError = true;
    }

    if (hasError) return;

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying security tokens...';
    alertEl.classList.add('hidden');

    try {
      let data;
      let isLocalFallback = false;
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password, rememberMe })
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html') || !response.ok) {
          if (response.status === 401 && !contentType.includes('text/html')) {
            const errData = await response.json();
            throw new Error(errData.error || 'Invalid credentials');
          }
          isLocalFallback = true;
        } else {
          data = await response.json();
        }
      } catch (fetchErr) {
        if (fetchErr.message === 'Invalid credentials' || fetchErr.message.includes('credentials') || fetchErr.message.includes('disabled')) {
          throw fetchErr;
        }
        isLocalFallback = true;
      }

      if (isLocalFallback) {
        throw new Error('Unable to reach the authentication service. Please try again later.');
      }

      // Login successful!
      submitBtn.textContent = 'Authenticated. Redirecting...';
      submitBtn.style.background = 'linear-gradient(135deg, var(--success), var(--success-hover))';
      
      if (data && data.user) {
        sessionStorage.setItem('current_user', JSON.stringify(data.user));
        localStorage.setItem('current_user', JSON.stringify(data.user));
      }

      // Redirect to correct dashboard
      setTimeout(() => {
        window.location.href = data.redirectUrl;
      }, 500);

    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
      alertEl.textContent = err.message || 'An unexpected error occurred. Please try again.';
      alertEl.className = 'text-danger';
      alertEl.classList.remove('hidden');
    }
  });
});
