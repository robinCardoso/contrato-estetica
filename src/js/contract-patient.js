import { getContractByToken, updateContractByToken } from './supabase.js';

const contractToken = new URLSearchParams(window.location.search).get('t');
let saveTimer = null;
let contractReady = false;

        document.addEventListener("DOMContentLoaded", async () => {
            if (!contractToken) {
                showContractError('Link inválido. Solicite um novo link à profissional.');
                return;
            }

            const cpfInput = document.getElementById('input-cpf');
            if (cpfInput) IMask(cpfInput, { mask: '000.000.000-00' });
            
            // MÃ¡scara para RG (Geralmente letras e nÃºmeros, dependendo do estado)
            const rgInput = document.getElementById('input-rg');
            if (rgInput) IMask(rgInput, { mask: /^[a-zA-Z0-9.-]*$/ }); 
            
            // MÃ¡scara para o Telefone
            const telInput = document.getElementById('input-telefone');
            if (telInput) IMask(telInput, {
                mask: [
                    { mask: '(00) 0000-0000' },
                    { mask: '(00) 00000-0000' }
                ]
            });
            
            // MÃ¡scara para Data (Dia)
            const diaInput = document.getElementById('input-dia');
            if (diaInput) IMask(diaInput, { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 });
            
            // MÃ¡scara para Data (Ano)
            const anoInput = document.getElementById('input-ano');
            if (anoInput) IMask(anoInput, { mask: '00' });
            
            // MÃ¡scara para Valor Total em Reais
            const valorInput = document.getElementById('input-valor');
            if (valorInput) IMask(valorInput, {
                mask: Number,
                scale: 2,
                signed: false,
                thousandsSeparator: '.',
                padFractionalZeros: true,
                normalizeZeros: true,
                radix: ','
            });

            // Adiciona escuta para salvar automaticamente em qualquer digitaÃ§Ã£o
            document.getElementById('document-container').addEventListener('input', saveFormData);
            document.getElementById('document-container').addEventListener('change', saveFormData);

            await loadContractFromServer();

            const photoLabel = document.getElementById('btn-photo-label');
            if (photoLabel) {
                photoLabel.addEventListener('click', function(e) {
                    if (canUseLiveCamera()) {
                        e.preventDefault();
                        openCameraModal();
                    }
                });
            }

            if (!window.isSecureContext) {
                const warning = document.getElementById('file-protocol-warning');
                if (warning) warning.classList.remove('hidden');
            }
        });

        // PREENCHIMENTO AUTOMÃTICO DA DATA ATUAL
        function fillCurrentDate() {
            const hoje = new Date();
            const diaInputEl = document.getElementById('input-dia');
            if (diaInputEl) diaInputEl.value = String(hoje.getDate()).padStart(2, '0');
            
            const meses = ["Janeiro", "Fevereiro", "MarÃ§o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const inputMes = document.getElementById('input-mes');
            if (inputMes) inputMes.value = meses[hoje.getMonth()];
            
            const anoInputEl = document.getElementById('input-ano');
            if (anoInputEl) anoInputEl.value = String(hoje.getFullYear()).slice(-2);
        }

        const readonlyFieldIds = [
            'plano-procedimentos', 'plano-regioes', 'plano-equipamentos',
            'plano-sessoes', 'plano-disparos', 'plano-ampolas',
            'input-valor', 'plano-pagamento', 'input-dia', 'input-mes', 'input-ano'
        ];

        function showContractError(message) {
            const loading = document.getElementById('contract-loading');
            const error = document.getElementById('contract-error');
            if (loading) loading.classList.add('hidden');
            if (error) {
                error.textContent = message;
                error.classList.remove('hidden');
            }
            document.getElementById('document-container')?.classList.add('hidden');
        }

        function hideContractLoading() {
            document.getElementById('contract-loading')?.classList.add('hidden');
        }

        function lockProfessionalFields() {
            readonlyFieldIds.forEach((id) => {
                const el = document.getElementById(id);
                if (el) {
                    el.readOnly = true;
                    el.classList.add('opacity-80');
                }
            });
        }

        function buildPatientPayload() {
            const authSim = document.getElementById('radio-auth-sim');
            const authNao = document.getElementById('radio-auth-nao');
            const imgElement = document.getElementById('patient-photo-img');

            let sigPaciente = modalImageBackup.paciente;
            if (!sigPaciente && !padPaciente.isEmpty()) {
                sigPaciente = padPaciente.toDataURL();
            }

            return {
                paciente_nome: document.getElementById('input-nome')?.value || '',
                paciente_cpf: document.getElementById('input-cpf')?.value || '',
                paciente_rg: document.getElementById('input-rg')?.value || '',
                paciente_telefone: document.getElementById('input-telefone')?.value || '',
                paciente_foto: imgElement && !imgElement.classList.contains('hidden') ? imgElement.src : '',
                foto_auth: authSim?.checked ? 'sim' : (authNao?.checked ? 'nao' : ''),
                sig_paciente: sigPaciente || '',
            };
        }

        function saveFormData() {
            if (!contractReady || !contractToken) return;
            clearTimeout(saveTimer);
            saveTimer = setTimeout(async () => {
                try {
                    await updateContractByToken(contractToken, buildPatientPayload());
                } catch (err) {
                    console.error('Erro ao salvar contrato:', err);
                }
            }, 800);
        }

        async function loadContractFromServer() {
            try {
                const data = await getContractByToken(contractToken);
                if (!data) {
                    showContractError('Contrato não encontrado ou link expirado.');
                    return;
                }

                const fieldMap = {
                    plano_procedimentos: 'plano-procedimentos',
                    plano_regioes: 'plano-regioes',
                    plano_equipamentos: 'plano-equipamentos',
                    plano_sessoes: 'plano-sessoes',
                    plano_disparos: 'plano-disparos',
                    plano_ampolas: 'plano-ampolas',
                    valor_total: 'input-valor',
                    plano_pagamento: 'plano-pagamento',
                    dia: 'input-dia',
                    mes: 'input-mes',
                    ano: 'input-ano',
                    paciente_nome: 'input-nome',
                    paciente_cpf: 'input-cpf',
                    paciente_rg: 'input-rg',
                    paciente_telefone: 'input-telefone',
                };

                Object.entries(fieldMap).forEach(([dbKey, elId]) => {
                    const el = document.getElementById(elId);
                    if (el && data[dbKey] !== undefined && data[dbKey] !== null) {
                        el.value = data[dbKey];
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });

                if (data.foto_auth === 'sim') document.getElementById('radio-auth-sim').checked = true;
                if (data.foto_auth === 'nao') document.getElementById('radio-auth-nao').checked = true;
                if (data.paciente_foto) applyPhoto(data.paciente_foto);

                setTimeout(() => {
                    if (data.sig_profissional) {
                        padProfissional.fromDataURL(data.sig_profissional);
                        modalImageBackup.profissional = data.sig_profissional;
                    }
                    if (data.sig_paciente) {
                        padPaciente.fromDataURL(data.sig_paciente);
                        modalImageBackup.paciente = data.sig_paciente;
                        document.getElementById('overlay-paciente-hint')?.classList.add('hidden');
                    }
                }, 150);

                lockProfessionalFields();
                contractReady = true;
                hideContractLoading();
            } catch (err) {
                console.error(err);
                showContractError('Não foi possível carregar o contrato. Verifique sua conexão.');
            }
        }

        // Inicialização dos Canvas para assinatura
        const canvasPaciente = document.getElementById('canvas-paciente');
        const canvasProfissional = document.getElementById('canvas-profissional');
        const modalCanvas = document.getElementById('modal-canvas');
        
        // OpÃ§Ãµes de performance otimizadas para rabisco ultra-rÃ¡pido e suave (60 FPS)
        const padOptions = {
            penColor: "rgb(0, 0, 128)", // Azul escuro
            backgroundColor: "rgba(255, 255, 255, 0)", // Transparente
            minWidth: 1.2,
            maxWidth: 3.0,
            throttle: 0, // Desativa delay entre pontos para rastreamento instantÃ¢neo
            velocityFilterWeight: 0.7 // SuavizaÃ§Ã£o fluida de curvas sem lag
        };

        const padPaciente = new SignaturePad(canvasPaciente, padOptions);
        const padProfissional = new SignaturePad(canvasProfissional, padOptions);
        const modalPad = new SignaturePad(modalCanvas, padOptions);

        let currentActiveTarget = null; // 'paciente' ou 'profissional'
        let modalImageBackup = { paciente: null, profissional: null }; // Backup do modal para repintura ao girar a tela

        // FunÃ§Ã£o crucial: Ajustar o tamanho interno do canvas para a resoluÃ§Ã£o da tela de forma otimizada
        function resizeCanvas() {
            // Limita o ratio mÃ¡ximo a 1.5 para telas Retina/SuperAMOLED nÃ£o sobrecarregarem o processador grÃ¡fico
            const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
            
            [canvasPaciente, canvasProfissional].forEach(canvas => {
                const pad = canvas.id === 'canvas-paciente' ? padPaciente : padProfissional;
                const data = pad.toData();

                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                canvas.getContext("2d").scale(ratio, ratio);
                
                pad.clear();
                if (data && data.length > 0) {
                    pad.fromData(data);
                } else {
                    const targetName = canvas.id === 'canvas-paciente' ? 'paciente' : 'profissional';
                    if (modalImageBackup[targetName]) {
                        pad.fromDataURL(modalImageBackup[targetName]);
                    }
                }
            });
        }

        function resizeModalCanvas() {
            if (!modalCanvas.offsetWidth) return;
            const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
            const data = modalPad.toData();

            modalCanvas.width = modalCanvas.offsetWidth * ratio;
            modalCanvas.height = modalCanvas.offsetHeight * ratio;
            modalCanvas.getContext("2d").scale(ratio, ratio);

            modalPad.clear();
            if (data && data.length > 0) {
                modalPad.fromData(data);
            } else if (currentActiveTarget && modalImageBackup[currentActiveTarget]) {
                modalPad.fromDataURL(modalImageBackup[currentActiveTarget]);
            }
        }

        // Executar no carregamento e ao redimensionar a tela
        window.addEventListener("resize", () => {
            resizeCanvas();
            if (!document.getElementById('signature-modal').classList.contains('hidden')) {
                resizeModalCanvas();
            }
        });
        resizeCanvas();

        // LÃ“GICA DO MODAL EXPANDIDO COM ESCALA PROPORCIONAL


        function openModal(target) {
            if (target !== 'paciente') return;
            currentActiveTarget = target;
            const modal = document.getElementById('signature-modal');
            const modalTitle = document.getElementById('modal-title');
            
            modalTitle.innerText = target === 'paciente' ? 'Assinatura da Paciente' : 'Assinatura da Profissional';
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            setTimeout(() => {
                resizeModalCanvas();
                modalPad.clear();
                const targetPad = target === 'paciente' ? padPaciente : padProfissional;
                
                // Se houver uma assinatura salva em imagem ou vetor, restaurar no modal
                if (modalImageBackup[target]) {
                    modalPad.fromDataURL(modalImageBackup[target]);
                } else if (!targetPad.isEmpty()) {
                    modalPad.fromDataURL(targetPad.toDataURL());
                }
            }, 50);
        }

        function closeModal() {
            const modal = document.getElementById('signature-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            modalPad.clear();
            currentActiveTarget = null;
        }

        // FunÃ§Ã£o auxiliar para recortar o excesso de transparÃªncia ao redor da assinatura
        function trimCanvas(canvas) {
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            
            let minX = width, minY = height, maxX = 0, maxY = 0;
            let hasContent = false;
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const alpha = data[(y * width + x) * 4 + 3];
                    if (alpha > 0) {
                        hasContent = true;
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            
            if (!hasContent) {
                return null;
            }
            
            // Margem de respiro (padding) ao redor dos traÃ§os da assinatura
            const padding = 15;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(width, maxX + padding);
            maxY = Math.min(height, maxY + padding);
            
            const cropW = maxX - minX;
            const cropH = maxY - minY;
            
            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = cropW;
            croppedCanvas.height = cropH;
            const croppedCtx = croppedCanvas.getContext('2d');
            
            croppedCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
            return croppedCanvas;
        }

        function saveModalSignature() {
            if (!currentActiveTarget) return;
            const targetPad = currentActiveTarget === 'paciente' ? padPaciente : padProfissional;
            const targetCanvas = currentActiveTarget === 'paciente' ? canvasPaciente : canvasProfissional;
            const hintOverlay = document.getElementById(`overlay-${currentActiveTarget}-hint`);

            if (modalPad.isEmpty()) {
                targetPad.clear();
                modalImageBackup[currentActiveTarget] = null;
                if (hintOverlay) hintOverlay.classList.remove('hidden');
                closeModal();
                return;
            }

            const isModified = modalPad.toData().length > 0;
            if (!isModified) {
                // A imagem jÃ¡ estava lÃ¡, o usuÃ¡rio nÃ£o desenhou nenhum traÃ§o novo.
                // Apenas fechamos para nÃ£o processar e encolher a assinatura novamente.
                closeModal();
                return;
            }

            // Recorta a assinatura para remover excesso de margens transparentes
            const croppedCanvas = trimCanvas(modalCanvas);
            if (!croppedCanvas) {
                targetPad.clear();
                modalImageBackup[currentActiveTarget] = null;
                if (hintOverlay) hintOverlay.classList.remove('hidden');
                closeModal();
                return;
            }

            // Verificar se o usuÃ¡rio assinou com o dispositivo na horizontal (Paisagem)
            const isLandscape = modalCanvas.width > modalCanvas.height;

            // Usar um canvas temporÃ¡rio sem interferÃªncia de devicePixelRatio para processar a assinatura
            const offscreen = document.createElement('canvas');
            const cssW = targetCanvas.offsetWidth;
            const cssH = targetCanvas.offsetHeight;
            offscreen.width = cssW;
            offscreen.height = cssH;
            const offCtx = offscreen.getContext('2d');

            if (isLandscape && window.innerHeight > window.innerWidth) {
                // Se o celular voltou para o modo em pÃ© (Retrato) mas a assinatura foi feita deitada:
                // Rotaciona a assinatura em -90 graus para desinverter e ficar na orientaÃ§Ã£o correta em pÃ©
                offCtx.translate(cssW / 2, cssH / 2);
                offCtx.rotate(-90 * Math.PI / 180);

                // A largura vira altura e vice-versa no cÃ¡lculo da proporÃ§Ã£o do cropped
                const hRatio = cssH / croppedCanvas.width;
                const vRatio = cssW / croppedCanvas.height;
                const ratio  = Math.min(hRatio, vRatio);

                const drawW = croppedCanvas.width * ratio;
                const drawH = croppedCanvas.height * ratio;

                offCtx.drawImage(croppedCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
            } else {
                // Desenho normal proporcional centralizado
                const hRatio = cssW / croppedCanvas.width;
                const vRatio = cssH / croppedCanvas.height;
                const ratio  = Math.min(hRatio, vRatio);
                
                const drawW = croppedCanvas.width * ratio;
                const drawH = croppedCanvas.height * ratio;

                const centerShift_x = (cssW - drawW) / 2;
                const centerShift_y = (cssH - drawH) / 2;
                
                offCtx.drawImage(croppedCanvas, 0, 0, croppedCanvas.width, croppedCanvas.height,
                                   centerShift_x, centerShift_y, drawW, drawH);
            }

            const processedDataUrl = offscreen.toDataURL("image/png");
            modalImageBackup[currentActiveTarget] = processedDataUrl;
            targetPad.clear();
            targetPad.fromDataURL(processedDataUrl);
            
            if (hintOverlay) hintOverlay.classList.add('hidden');
            closeModal();
            saveFormData(); // Salva estado apÃ³s assinar
        }

        function clearPatientSignature() {
            padPaciente.clear();
            modalImageBackup.paciente = null;
            const hint = document.getElementById('overlay-paciente-hint');
            if (hint) hint.classList.remove('hidden');
            saveFormData();
        }

        function clearProfissionalSignature() {
            padProfissional.clear();
            modalImageBackup.profissional = null;
            const hint = document.getElementById('overlay-profissional-hint');
            if (hint) hint.classList.remove('hidden');
            saveFormData();
        }

        function clearSignatures() {
            clearPatientSignature();
            clearProfissionalSignature();
        }

        // LÃ“GICA DE MANIPULAÃ‡ÃƒO DA FOTO DO PACIENTE E CÃ‚MERA (WEBCAM)
        let cameraStream = null;

        function isMobileDevice() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        }

        // getUserMedia exige HTTPS ou localhost; file:// nÃ£o funciona
        function canUseLiveCamera() {
            return window.isSecureContext &&
                   navigator.mediaDevices &&
                   typeof navigator.mediaDevices.getUserMedia === 'function' &&
                   !isMobileDevice();
        }

        function openGalleryPicker() {
            const input = document.getElementById('patient-photo-input');
            input.removeAttribute('capture');
            input.click();
        }

        function resetPhotoInputCapture() {
            const input = document.getElementById('patient-photo-input');
            if (input) input.setAttribute('capture', 'user');
        }

        function compressImage(base64Image, maxWidth = 800, quality = 0.82) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => reject(new Error('Falha ao processar imagem'));
                img.src = base64Image;
            });
        }

        async function openCameraModal() {
            const modal = document.getElementById('camera-modal');
            const video = document.getElementById('camera-video');
            const cameraError = document.getElementById('camera-error');
            const btnTakePhoto = document.getElementById('btn-take-photo');

            if (!window.isSecureContext) {
                alert('Para usar a cÃ¢mera ao vivo, abra este formulÃ¡rio por HTTPS ou localhost.\n\nEm arquivo local (file://), use o botÃ£o "Tirar / Anexar Foto" ou "Galeria".');
                return;
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            cameraError.classList.add('hidden');
            video.classList.remove('hidden');
            btnTakePhoto.disabled = false;

            const constraints = {
                video: {
                    facingMode: isMobileDevice() ? { ideal: 'user' } : 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            try {
                if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                    cameraStream = null;
                }
                cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
                video.setAttribute('playsinline', '');
                video.setAttribute('muted', '');
                video.srcObject = cameraStream;
                await video.play();
            } catch (err) {
                console.warn("Erro ao acessar a cÃ¢mera:", err);
                video.classList.add('hidden');
                cameraError.classList.remove('hidden');
                btnTakePhoto.disabled = true;
            }
        }

        function closeCameraModal() {
            const modal = document.getElementById('camera-modal');
            const video = document.getElementById('camera-video');

            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            video.srcObject = null;

            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        async function takeSnapshot() {
            const video = document.getElementById('camera-video');
            if (!video.srcObject) return;

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            try {
                const compressed = await compressImage(canvas.toDataURL('image/jpeg', 0.9));
                applyPhoto(compressed);
            } catch (err) {
                console.error(err);
                alert('NÃ£o foi possÃ­vel processar a foto. Tente novamente.');
            }
            closeCameraModal();
        }

        function triggerFileInputFromModal() {
            closeCameraModal();
            openGalleryPicker();
        }

        function applyPhoto(base64Image) {
            const imgElement = document.getElementById('patient-photo-img');
            const placeholder = document.getElementById('photo-placeholder');
            const btnRemove = document.getElementById('btn-remove-photo');
            const container = document.getElementById('photo-preview-container');

            imgElement.src = base64Image;
            imgElement.classList.remove('hidden');
            placeholder.classList.add('hidden');
            btnRemove.classList.remove('hidden');
            container.classList.remove('border-dashed');
            container.classList.add('border-solid', 'border-gray-200');
            saveFormData();
        }

        function handlePhotoUpload(event) {
            const file = event.target.files[0];
            resetPhotoInputCapture();
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const compressed = await compressImage(e.target.result);
                    applyPhoto(compressed);
                } catch (err) {
                    console.error(err);
                    alert('NÃ£o foi possÃ­vel carregar a imagem. Tente outro arquivo.');
                }
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        function removePhoto() {
            const imgElement = document.getElementById('patient-photo-img');
            const placeholder = document.getElementById('photo-placeholder');
            const btnRemove = document.getElementById('btn-remove-photo');
            const container = document.getElementById('photo-preview-container');
            const input = document.getElementById('patient-photo-input');

            imgElement.src = '';
            imgElement.classList.add('hidden');
            placeholder.classList.remove('hidden');
            btnRemove.classList.add('hidden');
            container.classList.add('border-dashed');
            container.classList.remove('border-solid', 'border-gray-200');
            input.value = '';
            saveFormData(); // Salva estado apÃ³s remover foto
        }

        function generatePDF() {
            const inputNome = document.getElementById('input-nome');
            const pacienteNome = inputNome && inputNome.value.trim() !== '' ? inputNome.value : 'Paciente';

            // ValidaÃ§Ã£o simples: Exigir o nome do paciente
            if (pacienteNome === 'Paciente') {
                alert("Por favor, preencha o Nome Completo do(a) paciente antes de gerar o PDF.");
                if (inputNome) inputNome.focus();
                return;
            }

            const btnGerar = document.getElementById('btn-gerar');
            const originalText = btnGerar.innerHTML;
            
            // Estado de carregamento
            btnGerar.innerHTML = 'Gerando PDF, aguarde...';
            btnGerar.disabled = true;
            btnGerar.classList.add('opacity-75');

            // Adicionar classe para ocultar botÃµes e formatar estilos para impressÃ£o
            document.body.classList.add('pdf-mode');

            const element = document.getElementById('document-container');
            const filename = `Contrato_${pacienteNome.trim().replace(/\s+/g, '_')}.pdf`;

            const opt = {
                margin:       [10, 10, 10, 10], // Margens (top, left, bottom, right) em mm
                filename:     filename,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { 
                    scale: 2, // Maior qualidade
                    useCORS: true,
                    scrollY: 0,
                    windowWidth: 800
                },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
            };

            // Gerar o PDF como Blob para compartilhamento ou download
            html2pdf().set(opt).from(element).output('blob').then((pdfBlob) => {
                // Restaurar estado apÃ³s a geraÃ§Ã£o
                document.body.classList.remove('pdf-mode');
                btnGerar.innerHTML = originalText;
                btnGerar.disabled = false;
                btnGerar.classList.remove('opacity-75');

                const file = new File([pdfBlob], filename, { type: 'application/pdf' });

                // Tentar usar o compartilhamento nativo do dispositivo (WhatsApp, E-mail, etc)
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    navigator.share({
                        files: [file],
                        title: 'Contrato de EstÃ©tica',
                        text: `Segue em anexo o Contrato de PrestaÃ§Ã£o de ServiÃ§os EstÃ©ticos de ${pacienteNome.trim()}.`
                    }).then(() => {
                        console.log("PDF compartilhado com sucesso!");
                    }).catch(err => {
                        console.warn("Compartilhamento cancelado ou falhou:", err);
                    });
                } else {
                    // Fallback para download tradicional em PCs ou navegadores sem suporte
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(pdfBlob);
                    link.download = filename;
                    link.click();
                    URL.revokeObjectURL(link.href);
                }
            }).catch(err => {
                console.error("Erro ao gerar PDF:", err);
                alert("Ocorreu um erro ao gerar o PDF. Tente novamente.");
                document.body.classList.remove('pdf-mode');
                btnGerar.innerHTML = originalText;
                btnGerar.disabled = false;
                btnGerar.classList.remove('opacity-75');
            });
        }

Object.assign(window, {
    openModal,
    closeModal,
    saveModalSignature,
    clearPatientSignature,
    openGalleryPicker,
    handlePhotoUpload,
    removePhoto,
    openCameraModal,
    closeCameraModal,
    takeSnapshot,
    triggerFileInputFromModal,
    generatePDF,
});

window.modalPad = modalPad;
