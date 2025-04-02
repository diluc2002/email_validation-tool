document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const errorMessage = document.getElementById('error-message');
    const resultCont = document.getElementById('resultCont');
    const submitButton = form.querySelector('button[type="submit"]');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    emailInput.addEventListener('input', () => {
        const email = emailInput.value.trim();
        if (emailRegex.test(email)) {
            emailInput.classList.remove('invalid');
            emailInput.setAttribute('aria-invalid', 'false');
        } else {
            emailInput.classList.add('invalid');
            emailInput.setAttribute('aria-invalid', 'true');
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();

        if (!emailRegex.test(email)) {
            errorMessage.style.display = 'block';
            errorMessage.textContent = 'Please enter a valid email format.';
            resultCont.textContent = 'Your results will show here';
            return;
        }

        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Validating...';
            resultCont.innerHTML = '<div class="spinner"></div>';
            errorMessage.style.display = 'none';

            const response = await fetch('/validate-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (data.valid) {
                errorMessage.style.display = 'none';
                resultCont.innerHTML = `
                    <p class="success"><i class="fas fa-check-circle"></i> <strong>Result:</strong> ${data.message}</p>
                    <ul>
                        <li><strong>Email Type:</strong>
                            ${data.details.isFreeEmail ? 'Free Email' : ''}
                            ${data.details.isDisposableEmail ? 'Disposable Email' : ''}
                            ${data.details.isRoleBasedEmail ? 'Role-Based Email' : ''}
                            ${!data.details.isFreeEmail && !data.details.isDisposableEmail && !data.details.isRoleBasedEmail ? 'Custom Email' : ''}
                        </li>
                        <li><strong>Domain:</strong> ${data.details.domain}</li>
                        <li><strong>Simulated Test Email Address:</strong> ${data.details.test_email_address}</li>
                        <li><strong>Simulated Validation:</strong> ${data.details.simulated_validation ? 'Yes' : 'No'}</li>
                    </ul>
                    <button id="clearButton">Clear</button>
                `;
            } else {
                resultCont.innerHTML = `
                    <p class="error"><i class="fas fa-times-circle"></i> <strong>Result:</strong> Email validation failed.</p>
                    <ul>
                        <li><strong>Error:</strong> ${data.details.error || 'Unknown error'}</li>
                    </ul>
                    <button id="clearButton">Clear</button>
                `;
                errorMessage.style.display = 'block';
                errorMessage.textContent = data.message || 'Email validation failed for an unknown reason.';
            }

            document.getElementById('clearButton').addEventListener('click', () => {
                emailInput.value = '';
                emailInput.classList.remove('invalid');
                errorMessage.style.display = 'none';
                resultCont.textContent = 'Your results will show here';
                submitButton.disabled = false;
                submitButton.textContent = 'Submit';
            });
        } catch (error) {
            resultCont.textContent = 'Your results will show here';
            errorMessage.style.display = 'block';
            errorMessage.textContent = 'Failed to connect to the server. Please try again later.';
            console.error('Client-side error:', error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit';
        }
    });
});