/** The enquiry form: client-side validation plus a POST to /api/enquiry. */

import { $ } from './util.js';

const FIELDS = [
  { input: '#fName', error: '#errName', message: 'Please tell us your name.',
    valid: (v) => v.trim().length > 0 },
  { input: '#fEmail', error: '#errEmail', message: 'Please enter a valid email address.',
    valid: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) },
  { input: '#fMessage', error: '#errMessage', message: 'Please describe the piece.',
    valid: (v) => v.trim().length > 0 },
];

export function initForm() {
  const form = $('#enquiryForm');
  if (!form) return;

  const status = $('#formStatus');
  const submit = $('#enquirySubmit');

  const setError = (field, message) => {
    const input = $(field.input);
    const error = $(field.error);
    if (error) error.textContent = message;
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  };

  const check = (field) => {
    const input = $(field.input);
    if (!input) return true;
    const ok = field.valid(input.value);
    setError(field, ok ? '' : field.message);
    return ok;
  };

  // Validate on blur, then live once a field has already been flagged.
  for (const field of FIELDS) {
    const input = $(field.input);
    if (!input) continue;
    input.addEventListener('blur', () => check(field));
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') check(field);
    });
  }

  const say = (message, ok) => {
    if (!status) return;
    status.textContent = message;
    status.className = `form-status form-status--${ok ? 'ok' : 'bad'}`;
    status.hidden = false;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const results = FIELDS.map(check);
    if (results.includes(false)) {
      say('Please check the highlighted fields.', false);
      $(FIELDS[results.indexOf(false)].input)?.focus();
      return;
    }

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'Sending…';

    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        say(data.message || 'Thank you — we will be in touch.', true);
        form.reset();
        FIELDS.forEach((f) => setError(f, ''));
      } else {
        // Mirror any server-side field errors back onto the form.
        for (const field of FIELDS) {
          const name = $(field.input)?.name;
          if (name && data.errors?.[name]) setError(field, data.errors[name]);
        }
        say('We could not send that. Please check the form and try again.', false);
      }
    } catch {
      say('The connection dropped. Please try again, or call the shop.', false);
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  });
}
