import jwt from "jsonwebtoken";
import EmailEntry from "../models/EmailEntry.js";

export const verifyToken = async (req, res) => {
  try {
    const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
    const email = typeof decoded?.email === "string" ? decoded.email : null;

    if (!email) {
      return res.json(decoded);
    }

    return EmailEntry.findOne({ email })
      .lean()
      .then((user) => {
        if (!user) {
          return res.json(decoded);
        }

        const sessionToken = jwt.sign(
          { userId: user._id.toString(), email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        return res.json({
          token: sessionToken,
          email: user.email,
          userId: user._id,
          name: user.name,
          country: user.country,
          action: decoded.action,
        });
      })
      .catch(() => res.status(500).json({ message: "Error interno" }));
  } catch {
    res.status(401).json({ message: "Token inválido" });
  }
};
