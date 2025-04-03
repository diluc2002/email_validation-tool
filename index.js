document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const errorMessage = document.getElementById('error-message');
    const resultCont = document.getElementById('resultCont');
    const submitButton = form.querySelector('button[type="submit"]');

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const MAILINATOR_API_KEY = 'YOUR_API_KEY_HERE';
    const MAILINATOR_API_URL = `https://api.mailinator.com/api/v2/domain`;

    // Common blacklist filters for fake/test emails
    const blacklistPatterns = ["invalid", "test", "fake", "demo", "noreply", "example", "temp"];

    const isBlacklisted = (email) => {
        const localPart = email.split("@")[0].toLowerCase();
        return blacklistPatterns.some((word) => localPart.includes(word));
    };

    async function isValidDomain(email) {
        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain) return false;

        try {
            const response = await fetch(`${MAILINATOR_API_URL}?domain=${encodeURIComponent(domain)}&key=${MAILINATOR_API_KEY}`);
            const data = await response.json();
            return data.disposable !== true; // True if not disposable
        } catch (error) {
            console.error('Mailinator API error:', error);
            return true; // Fallback to allow if API fails
        }
    }

    emailInput.addEventListener('input', () => {
        const email = emailInput.value.trim();
        if (emailRegex.test(email) && !email.includes("..") && email.split("@")[1]?.includes(".") && !isBlacklisted(email)) {
            emailInput.classList.remove('invalid');
            emailInput.setAttribute('aria-invalid', 'false');
            errorMessage.style.display = 'none';
        } else {
            emailInput.classList.add('invalid');
            emailInput.setAttribute('aria-invalid', 'true');
            errorMessage.style.display = 'block';
            errorMessage.textContent = 'Invalid email format or blacklisted keyword detected.';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();

        // Initial client-side checks
        if (!emailRegex.test(email) || email.includes("..") || !email.split("@")[1].includes(".") || isBlacklisted(email)) {
            resultCont.innerHTML = `
                <p class="error"><i class="fas fa-times-circle"></i> <strong>Result:</strong> Email validation failed.</p>
                <ul>
                    <li><strong>Error:</strong> ${isBlacklisted(email) ? 'Email contains blacklisted keywords.' : 'Invalid email format.'}</li>
                </ul>
                <button id="clearButton">Clear</button>
            `;
            errorMessage.style.display = 'block';

            document.getElementById('clearButton').addEventListener('click', clearForm);
            return;
        }

        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Validating...';
            resultCont.innerHTML = '<div class="spinner"></div>';
            errorMessage.style.display = 'none';

            // Check domain validity with Mailinator API
            const isDomainValid = await isValidDomain(email);
            if (!isDomainValid) {
                resultCont.innerHTML = `
                    <p class="error"><i class="fas fa-times-circle"></i> <strong>Result:</strong> Email validation failed.</p>
                    <ul>
                        <li><strong>Error:</strong> Domain is associated with a disposable or fake email service.</li>
                    </ul>
                    <button id="clearButton">Clear</button>
                `;
                errorMessage.style.display = 'block';
                errorMessage.textContent = 'Please use a non-disposable email domain.';
            } else {
                // Proceed with server-side validation if domain is valid
                const response = await fetch('https://email-validation-tool-ezx3.onrender.com/validate-email', { 
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
                            <li><strong>Error:</strong> ${data.details.error || 'Invalid email detected by server'}</li>
                        </ul>
                        <button id="clearButton">Clear</button>
                    `;
                    errorMessage.style.display = 'block';
                    errorMessage.textContent = data.message || 'Email validation failed.';
                }
            }

            document.getElementById('clearButton').addEventListener('click', clearForm);
        } catch (error) {
            resultCont.innerHTML = `
                <p class="error"><i class="fas fa-times-circle"></i> <strong>Result:</strong> Email validation failed.</p>
                <ul>
                    <li><strong>Error:</strong> Failed to connect to the server or API. Please try again later.</li>
                </ul>
                <button id="clearButton">Clear</button>
            `;
            errorMessage.style.display = 'block';
            errorMessage.textContent = 'Server or API connection failed.';
            console.error('Client-side error:', error);

            document.getElementById('clearButton').addEventListener('click', clearForm);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit';
        }
    });

    function clearForm() {
        emailInput.value = '';
        emailInput.classList.remove('invalid');
        errorMessage.style.display = 'none';
        resultCont.textContent = 'Your results will show here';
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
    }
});
