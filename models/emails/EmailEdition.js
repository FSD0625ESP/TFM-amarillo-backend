import React from "react";

export default function EditPhotosEmail({ link }) {
  return React.createElement(
    "div",
    {
      style: {
        background: "#0b1120",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
        color: "#e5e7eb",
      },
    },
    [
      React.createElement(
        "div",
        {
          key: "card",
          style: {
            maxWidth: "480px",
            margin: "0 auto",
            background: "#020617",
            borderRadius: "16px",
            padding: "24px",
            border: "1px solid #1f2937",
          },
        },
        [
          React.createElement(
            "h1",
            {
              key: "title",
              style: { color: "#f9fafb", marginBottom: "12px" },
            },
            "Proyecto Amarillo 💛"
          ),
          React.createElement(
            "p",
            { key: "hi" },
            "Hola de nuevo 👋"
          ),
          React.createElement(
            "p",
            { key: "desc" },
            "Hemos detectado que ya tienes fotos en el mosaico colaborativo. Usa este enlace para verlas y editarlas."
          ),
          React.createElement(
            "div",
            {
              key: "buttonBox",
              style: { textAlign: "center", margin: "24px 0" },
            },
            React.createElement(
              "a",
              {
                href: link,
                style: {
                  display: "inline-block",
                  padding: "10px 22px",
                  background:
                    "linear-gradient(90deg,#facc15,#f97316)",
                  color: "#111827",
                  borderRadius: "999px",
                  fontWeight: "600",
                  textDecoration: "none",
                },
              },
              "Ver y editar mis fotos"
            )
          ),
          React.createElement(
            "p",
            {
              key: "altText",
              style: { fontSize: "13px", color: "#9ca3af" },
            },
            [
              "O copia este enlace en tu navegador:",
              React.createElement("br", { key: "br" }),
              React.createElement(
                "a",
                {
                  key: "link",
                  href: link,
                  style: { color: "#93c5fd" },
                },
                link
              ),
            ]
          ),
          React.createElement(
            "p",
            {
              key: "exp",
              style: {
                fontSize: "11px",
                marginTop: "20px",
                color: "#6b7280",
              },
            },
            "Por seguridad, este enlace expirará en 2 horas."
          ),
        ]
      ),
    ]
  );
}
