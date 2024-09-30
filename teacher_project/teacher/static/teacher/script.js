// teacher/static/teacher/script.js

// Get references to UI elements
const startButton = document.getElementById('startBtn');
const stopButton = document.getElementById('stopBtn');
const resetButton = document.getElementById('resetBtn');
const statusElement = document.getElementById('status');
const chatBox = document.getElementById('chat-box');

// Variables for media recording
let mediaRecorder;
let audioChunks = [];

// Helper function to get CSRF token from cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
const csrfToken = getCookie('csrftoken');

// Function to initialize MediaRecorder
function initMediaRecorder() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Seu navegador não suporta gravação de áudio.');
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = function (e) {
                if (e.data && e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };

            mediaRecorder.onstop = function () {
                // Create a Blob from the recorded audio chunks
                let audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

                // Prepare FormData to send to the server
                let formData = new FormData();
                formData.append('audio', audioBlob, 'audio.webm');

                // Display status message
                statusElement.innerText = 'Enviando áudio para o servidor...';

                // Send the audio file to the server using Fetch API
                fetch('/process_audio/', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRFToken': csrfToken,
                    },
                })
                .then(response => {
                    if (!response.ok) {
                        // Handle HTTP errors
                        return response.json().then(errorData => {
                            throw new Error(errorData.message || 'Erro desconhecido no servidor.');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    statusElement.innerText = '';
                    if (data.transcription && data.ai_response) {
                        // Append user's transcription to chat
                        appendMessageToChat('user', 'Você: ' + data.transcription);

                        // Append AI's response to chat
                        appendMessageToChat('ai', 'Professor: ' + data.ai_response);

                                  // Play the AI's response using the audio data
                        if (data.audio_base64) {
                            let audioElement = new Audio('data:audio/mp3;base64,' + data.audio_base64);
                            audioElement.play();
                        }
                        // Scroll to the bottom of the chat box
                        chatBox.scrollTop = chatBox.scrollHeight;
                    } else {
                        // Handle unexpected responses
                        statusElement.innerText = 'Erro: Resposta inválida do servidor.';
                    }
                })
                .catch(error => {
                    // Display error messages
                    statusElement.innerText = 'Erro ao processar solicitação: ' + error.message;
                    console.error('Erro ao processar solicitação:', error);
                });
            };
        })
        .catch(function (err) {
            console.error('Erro ao acessar o microfone:', err);
            alert('Erro ao acessar o microfone: ' + err.message);
        });
}

// Function to append messages to the chat
function appendMessageToChat(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    messageElement.innerText = message;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;  // Scroll to bottom
}

// Initialize MediaRecorder when the page loads
initMediaRecorder();

// Event listeners for buttons
startButton.onclick = function () {
    if (!mediaRecorder) {
        alert('MediaRecorder não está disponível.');
        return;
    }

    if (mediaRecorder.state === 'recording') {
        alert('Gravação já está em andamento.');
        return;
    }

    audioChunks = [];
    mediaRecorder.start();
    statusElement.innerText = 'Gravação iniciada...';
};

stopButton.onclick = function () {
    if (!mediaRecorder) {
        alert('MediaRecorder não está disponível.');
        return;
    }

    if (mediaRecorder.state !== 'recording') {
        alert('MediaRecorder não está gravando.');
        return;
    }

    mediaRecorder.stop();
    statusElement.innerText = 'Gravação parada. Processando...';
};

resetButton.onclick = function () {
    if (confirm('Tem certeza de que deseja resetar a conversa?')) {
        // Clear the chat box
        chatBox.innerHTML = '';
        alert('Conversa resetada com sucesso.');
    }
};
