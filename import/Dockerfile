# Dienst „import“: liest PDFs und Texte für die Importe des Portals – ohne Netz, schreibgeschützt, als Benutzer 1000
# (wie die App, gemeinsamer Arbeitsordner data/import).
#   - poppler (pdftotext, pdftoppm): Text aus PDFs, Seitenbilder
#   - tesseract mit Deutsch: Texterkennung für gescannte PDFs
#   - llama.cpp mit Gemma 4 E4B (Google, Apache 2.0): macht aus dem Text einen Vorschlag in fester JSON-Form
# Feste Stände (Commit bzw. Prüfsumme) wie im Dienst „video“ des Intranets.

# --- llama.cpp bauen (fester Stand, Commit geprüft), nur llama-completion ---
FROM alpine:3.24 AS llama
ARG LLAMA_VERSION=v1.0.0
ARG LLAMA_COMMIT=b1b770d90d94cad9e9ea5b993bdbc383a522fb28
RUN apk add --no-cache build-base cmake git linux-headers
RUN git clone --depth 1 --branch "$LLAMA_VERSION" https://github.com/ggml-org/llama.cpp.git /src \
	&& test "$(git -C /src rev-parse HEAD)" = "$LLAMA_COMMIT"
# Ohne CPU-Erkennung beim Bauen: läuft auf allen x86-64-Servern mit AVX2 (seit etwa 2013)
RUN cmake -S /src -B /build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
		-DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON \
		-DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=OFF \
		-DLLAMA_BUILD_APP=OFF -DLLAMA_OPENSSL=OFF -DLLAMA_USE_PREBUILT_UI=OFF \
	&& cmake --build /build -j"$(nproc)" --target llama-completion \
	&& strip /build/bin/llama-completion

# --- Sprachmodell: Gemma 4 E4B (QAT, Q4_0) von Google, Apache 2.0 – fester Stand und SHA-256 ---
FROM alpine:3.24 AS sprachmodell
ARG LLM_REPO=google/gemma-4-E4B-it-qat-q4_0-gguf
ARG LLM_REVISION=4b4a2c1d584be7264f87aac328a1bc739ce81b6c
ARG LLM_DATEI=gemma-4-E4B_q4_0-it.gguf
ARG LLM_SHA256=676c35070db6dbe52f93e9c864ee0fba4eddea94b9c875d9cb10daff453fbaee
RUN mkdir /modelle \
	&& wget -q -O /modelle/sprachmodell.gguf \
		"https://huggingface.co/$LLM_REPO/resolve/$LLM_REVISION/$LLM_DATEI" \
	&& echo "$LLM_SHA256  /modelle/sprachmodell.gguf" | sha256sum -c -

FROM alpine:3.24
RUN apk add --no-cache poppler-utils tesseract-ocr tesseract-ocr-data-deu libstdc++ libgomp \
	&& addgroup -g 1000 lesen \
	&& adduser -D -H -u 1000 -G lesen lesen \
	&& mkdir -p /arbeit && chown lesen:lesen /arbeit && chmod 700 /arbeit
COPY --from=llama /build/bin/llama-completion /usr/local/bin/llama-completion
COPY --from=sprachmodell /modelle/sprachmodell.gguf /modelle/sprachmodell.gguf
COPY schulplan /usr/local/share/import/schulplan
COPY --chmod=0755 lesen.sh /usr/local/bin/lesen.sh
USER lesen
ENV ARBEIT=/arbeit SPRACHMODELL=/modelle/sprachmodell.gguf VORLAGEN=/usr/local/share/import
HEALTHCHECK --interval=60s --timeout=5s CMD test -w /arbeit
ENTRYPOINT ["/usr/local/bin/lesen.sh"]
