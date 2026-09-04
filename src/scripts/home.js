document.querySelectorAll('[data-coming-soon]').forEach((item) => {
  item.addEventListener('click', (event) => {
    event.preventDefault();
    const hint = document.querySelector('#home-hint');
    if (hint) hint.textContent = 'Этот модуль уже в списке. Скоро появится здесь.';
  });
});
