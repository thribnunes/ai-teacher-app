# teacher/views.py

import os
from openai import OpenAI
import tempfile
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt  # Remove in production
from dotenv import load_dotenv
from gtts import gTTS  # Import gTTS library
import base64 
# Load environment variables
load_dotenv()

# Instantiate the OpenAI client
client = OpenAI()

def index(request):
    return render(request, 'teacher/index.html')

# For development purposes, we can temporarily exempt CSRF checks
@csrf_exempt
def process_audio(request):
    if request.method == 'POST':
        audio_file = request.FILES.get('audio')
        if audio_file:
            # Save the uploaded audio file to a temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio_file:
                for chunk in audio_file.chunks():
                    temp_audio_file.write(chunk)
                temp_audio_file_path = temp_audio_file.name

            try:
                transcription_text = "Algo deu errado"
                with open(temp_audio_file_path, 'rb') as audio_file_for_transcription:
                    # Use OpenAI's Whisper API to transcribe the audio
                    transcription_response = client.audio.transcriptions.create(
                        model='whisper-1',
                        file=audio_file_for_transcription,
                        language='pt'
                    )
                    transcription_text = transcription_response.text

                # Cleanup temporary files
                os.unlink(temp_audio_file_path)

                # Generate a response using OpenAI's ChatCompletion API
                prompt = f"Você é um professor extremamente qualificado. Responda a seguinte pergunta:\n\n{transcription_text}"
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                    max_tokens=150,
                    temperature=0.7,
                )

                ai_response = response.choices[0].message.content.strip()

                # Generate speech from the AI's response using gTTS
                tts = gTTS(text=ai_response, lang='pt', slow=False)
                with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_audio_output:
                    tts.save(temp_audio_output.name)
                    temp_audio_output_path = temp_audio_output.name

                # Read the generated audio file and encode it in base64
                with open(temp_audio_output_path, 'rb') as audio_file:
                    audio_data = audio_file.read()
                    audio_base64 = base64.b64encode(audio_data).decode('utf-8')

                # Cleanup temporary TTS audio file
                os.unlink(temp_audio_output_path)

                # Return the transcription, AI response, and audio to the frontend
                return JsonResponse({
                    'transcription': transcription_text,
                    'ai_response': ai_response,
                    'audio_base64': audio_base64
                })
            except Exception as e:
                print(f"Error during processing: {e}")
                return JsonResponse({'message': 'Error during processing.'}, status=500)
        else:
            return JsonResponse({'message': 'No audio file received.'}, status=400)
    else:
        return JsonResponse({'message': 'Invalid request method.'}, status=405)
