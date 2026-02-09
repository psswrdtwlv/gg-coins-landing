// Ничего "красным навсегда" не фиксируем. Просто простые обработчики.

document.addEventListener("DOMContentLoaded", () => {
  const btnRefresh = document.getElementById("btnRefresh");

  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      // если у тебя раньше тут была логика обновления данных — вставь её сюда
      // сейчас делаем безопасно: просто перезагрузка страницы
      window.location.reload();
    });
  }

  // Нажатия по "магазину" — сейчас просто подсветка/алерт, чтобы кнопки были кликабельны
  document.querySelectorAll(".shop__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-shop");
      // Тут можешь заменить на открытие модалки / переход / копирование инфо для HR
      alert(`Выбрано: ${key}`);
    });
  });

  // Плавный скролл по якорям
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
});
