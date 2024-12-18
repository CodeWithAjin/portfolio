document.addEventListener("DOMContentLoaded", () => {
    // Elements to animate
    const imageContainer = document.querySelector('.image-container');
    const content = document.querySelector('.content');
    const footer = document.querySelector('footer');

    // Smooth Fade-In Animation for Hero Section on Page Load
    setTimeout(() => {
        if (imageContainer) imageContainer.style.opacity = '1';
        if (imageContainer) imageContainer.style.transform = 'translateY(0)';
        if (content) content.style.opacity = '1';
        if (content) content.style.transform = 'translateY(0)';
    }, 500);

    // Footer Visibility on Scroll
    window.addEventListener("scroll", () => {
        if (window.scrollY > 100) {
            document.body.classList.add("scrolled");
        } else {
            document.body.classList.remove("scrolled");
        }
    });

    // Button Visual Effects on Hover
    const buttons = document.querySelectorAll('.circle-btn');
    buttons.forEach(button => {
        button.addEventListener('mouseover', () => {
            button.style.transform = 'scale(1.1)';
            button.style.transition = 'transform 0.3s ease';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });
    });

    // Contact Form Submission Handler (Dummy Example)
    const contactForm = document.querySelector('form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Thank you for reaching out! I will get back to you soon.');
            contactForm.reset();
        });
    }
});
