document.addEventListener('DOMContentLoaded', () => {
    // Variables
    const body = document.body;
    const footer = document.querySelector('footer');
    const imageContainer = document.querySelector('.image-container');
    const contentContainer = document.querySelector('.content');
    const buttons = document.querySelectorAll('.circle-btn');

    // Footer Visibility on Scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            body.classList.add('scrolled');
        } else {
            body.classList.remove('scrolled');
        }
    });

    // Image and Content Fade-In Animations
    function fadeInElements() {
        // Trigger image fade-in
        imageContainer.style.opacity = '1';
        imageContainer.style.transform = 'translateY(0)';

        // Trigger content fade-in
        contentContainer.style.opacity = '1';
        contentContainer.style.transform = 'translateY(0)';
    }

    // Call fade-in function after page load
    fadeInElements();

    // Add Button Click Effects
    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            button.style.transform = 'scale(1.2)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 200); // Reset after 200ms
        });
    });
});
