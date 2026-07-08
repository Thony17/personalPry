const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = "es-ES";
recognition.continuous = false; // Importante: procesa un solo resultado

// Referencia a los elementos del DOM
const startBtn = document.getElementById('startButton');
const result = document.getElementById('status');

// Declaración de variables globales
let audioCtx;
let analyser;
let mediaStreamSource;
let analysisFrame; // Para controlar el bucle de análisis
const MALE_VOICE_THRESHOLD = 190; // Umbral en Hz para diferenciar
let collectedFrequencies = [];

// Función principal para iniciar el análisis de voz
startBtn.addEventListener('click', () => {

    // Inicializa el análisis de audio y el reconocimiento de voz
    startVoiceAnalysisAndRecognition();
});


// Funcion para iniciar el análisis de voz y reconocimiento
async function startVoiceAnalysisAndRecognition() {
    try {
        // Solicitando acceso del micrófono
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Configurando el analizador de audio
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        mediaStreamSource = audioCtx.createMediaStreamSource(stream);
        mediaStreamSource.connect(analyser);
        
        // Limpia mediciones anteriores
        collectedFrequencies = [];

        // Inicia el bucle de análisis de frecuencia
        analyzeFrequency();

        // Inicia el reconocimiento de voz
        recognition.start();

        // Detener el stream cuando el reconocimiento termine
        recognition.onend = () => {
            stream.getTracks().forEach(track => track.stop());
            cancelAnimationFrame(analysisFrame); // Detiene el bucle de análisis
        };

    } catch (err) {
        result.innerHTML = `Error al acceder al micrófono: ${err.message}`;
    }
}

// FUNCIÓN PARA ANALIZAR LA FRECUENCIA EN BUCLE
function analyzeFrequency() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let maxVal = 0;
    let maxIndex = 0;

    for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxVal) {
            maxVal = dataArray[i];
            maxIndex = i;
        }
    }
    
    // Solo recolecta si hay sonido detectable
    if(maxVal > 0) {
        const dominantFrequency = maxIndex * audioCtx.sampleRate / analyser.fftSize;

        // Solo considera frecuencias dentro de un rango vocal plausible (ej. 70Hz a 350Hz)
        if (dominantFrequency > 70 && dominantFrequency < 350) {
            collectedFrequencies.push(dominantFrequency);
        }
    }
    
    // Continúa el bucle
    analysisFrame = requestAnimationFrame(analyzeFrequency);
}

// RECONOCIMIENTO DE VOZ
recognition.onstart = () => {
    result.innerHTML = 'Escuchando... Habla ahora.';
};

recognition.onresult = (event) => {
    cancelAnimationFrame(analysisFrame); // Detiene el análisis inmediatamente

    const transcript = event.results[0][0].transcript;

    // Calcula la frecuencia promedio de lo que se escuchó
    const averageFrequency = collectedFrequencies.reduce((a, b) => a + b, 0) / collectedFrequencies.length;
    let voiceType = 'indeterminado';
    if (averageFrequency && averageFrequency > 70) { // Ignora el ruido de baja frecuencia
        voiceType = averageFrequency < MALE_VOICE_THRESHOLD ? 'femenino' : 'masculino';
    }

    // Llama a la función para leer el texto, pasando el tipo de voz detectado
    leerTexto(transcript, voiceType);
};

recognition.onerror = (event) => {
    result.innerHTML = `Ha ocurrido un error durante el Reconocimiento: ${event.error}`;
    cancelAnimationFrame(analysisFrame);
};

// Función para leer el texto
function leerTexto(textoHablado, tipoVoz) {
    const texto = new SpeechSynthesisUtterance(textoHablado);

    // Cambia la voz basado en el análisis de frecuencia
    if (tipoVoz === 'femenino') {
        texto.lang = 'es-PE';    
    } else {
        // Obtener una voz masculina de la lista de voces disponibles
        const voces = speechSynthesis.getVoices();
        const vozMasculina = voces.find(voz => voz.name.toLowerCase().includes('masculino') || voz.name.toLowerCase().includes('hombre'));
        if (vozMasculina) {
            texto.voice = vozMasculina;
        }

        // texto.lang = 'es-AR';
    }

    // Reproduce el texto hablado y muestra el resultado
    speechSynthesis.speak(texto);
    result.innerHTML = `Resultado: ${textoHablado} (Voz: ${tipoVoz})`;
}