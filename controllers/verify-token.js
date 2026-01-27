import jwt from "jsonwebtoken";

export const verifyToken = (req, res) => {
  try {
    const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
    res.json(decoded);
  } catch {
    res.status(401).json({ message: "Token inválido" });
  }
};
