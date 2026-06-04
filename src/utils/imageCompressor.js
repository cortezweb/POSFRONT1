/**
 * Comprime una imagen del lado del cliente usando Canvas y la convierte a WebP.
 * @param {File} file - Archivo original de imagen
 * @param {number} maxWidth - Ancho máximo deseado (por defecto 800px)
 * @param {number} quality - Calidad de compresión de 0 a 1 (por defecto 0.75)
 * @returns {Promise<Blob>} - Retorna una promesa con el Blob comprimido en WebP
 */
export const compressImage = (file, maxWidth = 800, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calcular nuevas proporciones
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a blob WebP
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Error al comprimir la imagen."));
            }
          },
          "image/webp",
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
