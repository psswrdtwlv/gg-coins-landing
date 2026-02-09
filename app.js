(() => {
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modalBody");

  const texts = {
    ozon: "Подарок: OZON. Сообщи HR, что хочешь сертификат OZON и свой контакт.",
    wb: "Подарок: WILDBERRIES. Сообщи HR, что хочешь сертификат Wildberries и свой контакт.",
    tgpremium: "Подарок: TG Premium. Сообщи HR, что хочешь подписку TG Premium и свой контакт.",
    surprice: "Подарок: SURPRISE. Сообщи HR, что выбираешь «Сюрприз».",
    gggift: "Подарок: КОРП. ПОДАРКИ. Сообщи HR, что выбираешь корпоративный подарок."
  };

  function openModal(text) {
    modalBody.textContent = text;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  document.addEventListener("click", (e) => {
    const close = e.target.closest("[data-close]");
    if (close) {
      closeModal();
      return;
    }

    const card = e.target.closest(".shop-card");
    if (card) {
      const key = card.getAttribute("data-shop");
      openModal(texts[key] || "Выбран подарок. Сообщи HR выбранный вариант.");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
})();
