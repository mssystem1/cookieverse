export const baseAppStyles = `
  .base-app-root {
    width: 100%;
    margin: 0 auto;
    background: #0b0b10;
  }

  @media (min-width: 1025px) {
    .base-app-root {
      max-width: 1280px;
      padding: 16px;
    }
  }

  @media (max-width: 1024px), (pointer: coarse) {
    .base-app-root {
      box-sizing: border-box;
      width: 100%;
      max-width: 480px;
      min-height: 100dvh;
      margin: 0 auto;
      padding: 8px 0 12px;
      overflow-x: hidden;
    }

    .base-app-root .page {
      max-width: 100%;
      padding: 12px;
    }

    .base-app-root .grid {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .base-app-root .card {
      padding: 14px !important;
      border-radius: 14px !important;
    }

    .base-app-root .card__title {
      font-size: 12px !important;
      margin-bottom: 8px !important;
      letter-spacing: 0.08em;
    }

    .base-app-root .input,
    .base-app-root .textarea,
    .base-app-root select,
    .base-app-root input,
    .base-app-root textarea {
      width: 100% !important;
      max-width: 100%;
      padding: 8px 10px !important;
      font-size: 14px !important;
    }

    .base-app-root .textarea,
    .base-app-root textarea {
      min-height: 100px !important;
    }

    .base-app-root .btn,
    .base-app-root button {
      padding: 9px 12px !important;
      font-size: 13px !important;
      border-radius: 10px !important;
    }

    .base-app-root .two-col {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .base-app-root .list {
      gap: 4px !important;
    }

    .base-app-root table {
      font-size: 12px !important;
    }

    .base-app-root th,
    .base-app-root td {
      padding: 7px 6px !important;
    }
  }
`;