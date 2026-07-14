const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser();
const pdfPath = path.resolve(__dirname, 'INFORME-13-07-26-PRESAS.pdf');

pdfParser.on("pdfParser_dataError", errData => console.error("Error:", errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    console.log("PDF parsed successfully.");
    const texto = pdfParser.getRawTextContent();
    console.log("Extracted text length:", texto.length);
    fs.writeFileSync('texto_extraido.txt', texto);
    console.log("PDF convertido a texto plano en texto_extraido.txt");
});

console.log("Loading PDF:", pdfPath);
pdfParser.loadPDF(pdfPath);