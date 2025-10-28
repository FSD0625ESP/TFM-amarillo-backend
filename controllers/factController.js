import Fact from "../models/Fact.js";

export const addFact = async (req, res) => {
  try {
    const data = req.body;
    //chequeamos si hay un array de datos (o un dato solo)
    if (Array.isArray(data)) {
      // validar que todos tengan el campo text
      if (!data.every((fact) => fact.text)) {
        return res
          .status(400)
          .json({ error: "Todos los facts deben tener el campo `text`" });
      }
      //aqui, luego de la comprobacion, de que todos tengan el campo text, los agrega.. insertMany() es un metodo de Mongoose
      const newFacts = await Fact.insertMany(data);
      return res
        .status(201)
        .json({ message: "Facts Creados Exitosamente", facts: newFacts });
    }
    // si es un solo fact
    const { text } = data;

    if (!text) {
      return res.status(400).json({ error: "Falta el campo 'Text'" });
    }
    const newFact = await Fact.create({ text });

    res.status(201).json({ message: "Fact creado con exito", fact: newFact });
  } catch (error) {
    console.error(error);
    console.error("Error al guardar fact(s):", error);
    res.status(500).json({ error: "Error al guardar fact(s)" });
  }
};

export const getRandomFact = async (req, res) => {
  try {
    const result = await Fact.aggregate([{ $sample: { size: 1 } }]);
    const randomFact = result[0];

    if (!randomFact) {
      return res.status(404).json({ error: "No se encontró ningún fact" });
    }

    res.status(200).json({ fact: randomFact });
  } catch (error) {
    console.error("Error al obtener fact aleatorio:", error);
    res.status(500).json({ error: "Error al obtener fact aleatorio" });
  }
};
