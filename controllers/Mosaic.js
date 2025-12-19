const mosaicGrid = [];
    const mainImageWidth = 1000 //aquí tenéis que definir el ancho de vuestra imagen principal
    const mainImageHeight = 1000 //aquí tenéis que definir el alto de vuestra imagen principal
    const tileWidth = 1 //aquí definis el tamaño horizontal de la baldosa
    const tileHeight = 1 //aquí definis el tamaño vertical de la baldosa
    const totalTiles = mainImageWidth * mainImageHeight
    let processedTiles = 0;
    
    /* 
    analizamos cada tile 
    */
    for (let row = 0; row < gridSize; row++) {
      const gridRow = [];
      
      for (let col = 0; col < gridSize; col++) {
        const left = col * tileWidth;
        const top = row * tileHeight;
        
        try {
          // Extract tile from main image
          const tileBuffer = await mainImage
            .clone()
            .extract({ 
              left: Math.min(left, mainWidth - tileWidth), 
              top: Math.min(top, mainHeight - tileHeight), 
              width: tileWidth, 
              height: tileHeight 
            })
            .toBuffer();
          
          // Get dominant color of this tile
          const tileColors = await extractColors(tileBuffer, 1);
          const dominantColor = tileColors[0] || [128, 128, 128];
          
          //aquí deberíamos guardar el color dominante en base de datos
          
        } catch (error) {
          console.error(`Error processing grid tile [${row}, ${col}]:`, error);
          // Add default tile
          gridRow.push({
            position: { row, col },
            targetColor: [128, 128, 128],
            matchedTile: tileColorPalette[0] || { imageId: 'default', imageUrl: '', color: [128, 128, 128] },
            coordinates: { left, top, width: tileWidth, height: tileHeight }
          });
        }
    }
       /***
   Uso de la función extractColor(imageBuffer, colorCount)
   
   Al subir una imagen debería calcularse los colores principales mediante la llamada a esta función, tal como se muestra en el ejemplo. Extrae 1 color dominante (por defecto) automáticamente al subir y los almacena en un array (por si se solicitaran más colores) en la respuesta para uso futuro.
   
   // Extract dominant colors from the uploaded image  
	const colors = await extractColors(req.file.buffer);  
	  
	res.json({  
	success: true,  
	image: {  
	public_id: result.public_id,  
	url: result.secure_url,  
	width: result.width,  
	height: result.height,  
	colors: colors  
	}  
	});
   
   ***/
   
   
   async function extractColors(imageBuffer, colorCount = 1) {
  try {
    /*
    -Redimensiona la imagen a 100×100 píxeles para acelerar el procesamiento
	- Convierte a formato raw (datos RGB sin comprimir)
	- Esto reduce drásticamente el tiempo de análisis sin perder precisión significativa
	*/
    const resizedBuffer = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'cover' })
      .raw()
      .toBuffer();

    /*
	- Calcula cuántos píxeles muestrear (hasta 1000)
	- Define el "paso" para saltar entre píxeles
	*/
    const colors = [];
    const pixelCount = resizedBuffer.length / 3;
    const sampleSize = Math.min(1000, pixelCount); // Sample up to 1000 pixels
    const step = Math.floor(pixelCount / sampleSize);

    const colorMap = new Map();

    for (let i = 0; i < resizedBuffer.length; i += step * 3) {
      if (i + 2 < resizedBuffer.length) {
        const r = resizedBuffer[i];
        const g = resizedBuffer[i + 1];
        const b = resizedBuffer[i + 2];
        
        /* 
        Cuantización de Colores.
        - Agrupa colores similares (ej: RGB(120,45,67) y RGB(125,48,65) se consideran iguales)
        - Divide el rango 0-255 en 8 segmentos (256/32 = 8)
          - Reduce variaciones insignificantes y mejora la detección de colores dominantes
        */
        const qR = Math.floor(r / 32) * 32;
        const qG = Math.floor(g / 32) * 32;
        const qB = Math.floor(b / 32) * 32;
        
        /* 
        Conteo de frecuencias
        - Usa un `Map` para contar cuántas veces aparece cada color cuantizado
		- La clave es una cadena "R,G,B"
		*/
        const colorKey = `${qR},${qG},${qB}`;
        colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
      }
    }
    
	/*
	Ordenamiento y Selección
    - Ordena los colores por frecuencia de aparición
	- Retorna los `colorCount` colores más dominantes (por defecto 5)
	- Convierte de vuelta a arrays numéricos `[R, G, B]`
	*/
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, colorCount)
      .map(([colorKey]) => colorKey.split(',').map(Number));

    return sortedColors.length > 0 ? sortedColors : [[128, 128, 128]]; // Default gray
  } catch (error) {
    console.error('Color extraction error:', error);
    return [[128, 128, 128]]; // Default gray on error
  }
}   


function colorDistance(color1, color2) {  
const [r1, g1, b1] = color1;  
const [r2, g2, b2] = color2;  
  
return Math.sqrt(  
Math.pow(r2 - r1, 2) +  
Math.pow(g2 - g1, 2) +  
Math.pow(b2 - b1, 2)  
);  
}
}