// =======================
// TABS (Все / Операторы / АУП)
// =======================
document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab");
  const refreshBtn = document.getElementById("refreshBtn");
  const status = document.getElementById("ratingStatus");

  let currentTab = "all";

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // снять active со всех
      tabs.forEach(t => t.classList.remove("is-active"));

      // поставить active на кликнутую
      tab.classList.add("is-active");

      currentTab = tab.dataset.tab;
      status.textContent = `Выбран фильтр: ${tab.textContent}`;
      
      // тут в будущем можно дергать фильтрацию
      // filterTable(currentTab);
    });
  });

  // =======================
  // REFRESH
  // =======================
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      status.textContent = "Обновление данных...";
      
      // имитация обновления (API/Excel позже)
      setTimeout(() => {
        status.textContent = "Данные обновлены";
      }, 600);
    });
  }
});
