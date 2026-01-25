import React from "react";

export default function VerificationEmail({ verificationLink }) {
  return React.createElement(
    "div",
    {
      style: {
        background: "#0b1120",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
        color: "#000000ff",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          maxWidth: "480px",
          margin: "0 auto",
          background: "#fff8f2",
          borderRadius: "16px",
          padding: "24px",
          border: "1px solid #1f2937",
        },
      },
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "h1",
          { style: { color: "#f9fafb", marginBottom: "12px" } },
          "Equipo Amarillo 💛"
        ),

        React.createElement("p", null, "Hola 👋"),

        React.createElement(
          "p",
          null,
          "Haz clic en el botón para completar tu registro en el Proyecto Amarillo."
        ),

        React.createElement(
          "div",
          { style: { textAlign: "center", margin: "24px 0" } },
          React.createElement(
            "a",
            {
              href: verificationLink,
              style: {
                display: "inline-block",
                padding: "10px 22px",
                background: "linear-gradient(90deg,#facc15,#f97316)",
                color: "#111827",
                borderRadius: "999px",
                fontWeight: "600",
                textDecoration: "none",
              },
            },
            "Completar registro"
          )
        ),

        React.createElement(
          "p",
          { style: { fontSize: "13px", color: "#ffffffff" } },
          React.createElement(
            React.Fragment,
            null,
            "O copia este enlace en tu navegador:",
            React.createElement("br"),
            React.createElement(
              "a",
              { href: verificationLink, style: { color: "#93c5fd" } },
              verificationLink
            )
          )
        ),

        React.createElement(
          "p",
          {
            style: {
              fontSize: "11px",
              marginTop: "20px",
              color: "#ffffffff",
            },
          },
          "Este enlace expirará en 2 horas."
        )
      )
    ),

    React.createElement(
      "p",
      {
        style: {
          fontSize: "11px",
          marginTop: "12px",
          textAlign: "center",
          color: "#ffffffff",
        },
      },
      "Si no solicitaste este correo, puedes ignorarlo."
    )
  );
}
