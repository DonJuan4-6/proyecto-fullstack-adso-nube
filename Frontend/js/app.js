(() => {
    const date = document.getElementById("today-date");

    if (date) {
        date.textContent = new Intl.DateTimeFormat("es-CO", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        }).format(new Date());
    }

    const money = value => new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);

    const read = key => JSON.parse(localStorage.getItem(key) || "[]");

    const write = (key, data) => {
        localStorage.setItem(key, JSON.stringify(data));
    };

    const id = () => (
        crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now() + Math.random())
    );

    const toast = message => {
        const element = document.getElementById("toast");

        if (!element) return;

        element.textContent = message;
        element.classList.add("show");

        clearTimeout(window.toastTimer);

        window.toastTimer = setTimeout(() => {
            element.classList.remove("show");
        }, 2600);
    };

    const api = async (path, options = {}) => {
        const baseUrl = window.APP_CONFIG.API_URL.replace(/\/+$/, "");
        const response = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        if (response.status === 204) {
            return null;
        }

        const body = await response.json();

        if (!response.ok) {
            const detail = body.detail
                ? (typeof body.detail === "string"
                    ? body.detail
                    : JSON.stringify(body.detail))
                : `Error ${response.status}`;
            throw new Error(detail);
        }

        return body;
    };

    const store = {
        async getStudents() {
            return window.APP_CONFIG.USE_API
                ? api("/estudiantes")
                : read("gs_students");
        },

        async saveStudent(data, studentId) {
            if (window.APP_CONFIG.USE_API) {
                return studentId
                    ? api(`/estudiantes/${studentId}`, {
                        method: "PUT",
                        body: JSON.stringify(data)
                    })
                    : api("/estudiantes", {
                        method: "POST",
                        body: JSON.stringify(data)
                    });
            }

            const list = read("gs_students");

            if (studentId) {
                const index = list.findIndex(student => student.id === studentId);

                if (index >= 0) {
                    list[index] = { ...list[index], ...data };
                }
            } else {
                list.push({ id: id(), ...data });
            }

            write("gs_students", list);

            return list;
        },

        async deleteStudent(studentId) {
            if (window.APP_CONFIG.USE_API) {
                return api(`/estudiantes/${studentId}`, {
                    method: "DELETE"
                });
            }

            write(
                "gs_students",
                read("gs_students").filter(student => student.id !== studentId)
            );
        },

        async getEnrollments() {
            return window.APP_CONFIG.USE_API
                ? api("/matriculas")
                : read("gs_enrollments");
        },

        async saveEnrollment(data) {
            if (window.APP_CONFIG.USE_API) {
                return api("/matriculas", {
                    method: "POST",
                    body: JSON.stringify(data)
                });
            }

            const list = read("gs_enrollments");

            list.push({ id: id(), ...data });
            write("gs_enrollments", list);

            return list;
        },

        async updateEnrollment(enrollmentId, data) {
            if (window.APP_CONFIG.USE_API) {
                return api(`/matriculas/${enrollmentId}`, {
                    method: "PUT",
                    body: JSON.stringify(data)
                });
            }

            const list = read("gs_enrollments").map(enrollment => (
                enrollment.id === enrollmentId
                    ? { ...enrollment, ...data }
                    : enrollment
            ));

            write("gs_enrollments", list);
        },

        async deleteEnrollment(enrollmentId) {
            if (window.APP_CONFIG.USE_API) {
                return api(`/matriculas/${enrollmentId}`, {
                    method: "DELETE"
                });
            }

            write(
                "gs_enrollments",
                read("gs_enrollments").filter(enrollment => enrollment.id !== enrollmentId)
            );
        }
    };

    window.GS = {
        money,
        read,
        write,
        toast,
        store
    };

    const page = document.body.dataset.page;

    if (page === "catalog") {
        initCatalog();
    } else if (page === "dashboard") {
        loadDashboard();
    }

    async function initCatalog() {
        const cardContainer = document.getElementById("cards-container");
        const recordCount = document.getElementById("record-count");
        const catalogFeedback = document.getElementById("catalog-feedback");
        const catalogSection = document.getElementById("catalog-section");
        const formSection = document.getElementById("seccion-formulario");
        const form = document.getElementById("enrollment-form");
        const formFeedback = document.getElementById("form-feedback");
        const previewWrap = document.getElementById("preview-wrap");
        const previewImage = document.getElementById("image-preview");
        const imageInput = document.getElementById("imagen-url");
        const filterButtons = document.querySelectorAll("[data-filter]");
        const placeholderImage =
            "https://via.placeholder.com/300x180?text=Global+Speak";
        let currentFilter = "all";

        window.todosLosRegistros = [];

        function setFormEnabled(enabled) {
            form.querySelectorAll("input, select, textarea, button").forEach(control => {
                control.disabled = !enabled;
            });
        }

        function closeForm() {
            form.reset();
            formFeedback.textContent = "";
            previewImage.removeAttribute("src");
            previewWrap.hidden = true;
            setFormEnabled(false);
            formSection.hidden = true;
            catalogSection.hidden = false;
            setActiveFilter("all");
        }

        function setActiveFilter(filter) {
            currentFilter = filter;
            filterButtons.forEach(button => {
                const active = button.dataset.filter === filter;
                button.classList.toggle("active", active);
                button.setAttribute("aria-pressed", String(active));
            });
            document.getElementById("open-form").classList.remove("active");
        }

        function renderCards() {
            const records = window.todosLosRegistros.filter(item => {
                if (currentFilter === "paid") return item.pagado === true;
                if (currentFilter === "pending") return item.pagado === false;
                return true;
            });

            recordCount.textContent =
                `${records.length} ${records.length === 1 ? "registro" : "registros"}`;
            cardContainer.replaceChildren();

            if (!records.length) {
                const emptyState = document.createElement("p");
                emptyState.className = "empty-state";
                emptyState.textContent = "No hay matrículas para mostrar en esta categoría.";
                cardContainer.append(emptyState);
                return;
            }

            records.forEach(item => {
                const card = document.createElement("article");
                card.className = "student-card";

                const image = document.createElement("img");
                image.className = "card-image";
                image.src = item.imagen_url || placeholderImage;
                image.alt = item.estudiante || "Estudiante de Global Speak";
                image.addEventListener("error", () => {
                    image.src = placeholderImage;
                }, { once: true });

                const content = document.createElement("div");
                content.className = "card-content";

                const topLine = document.createElement("div");
                topLine.className = "card-topline";

                const name = document.createElement("h3");
                name.className = "student-name";
                name.textContent = item.estudiante || "Sin nombre";

                const badge = document.createElement("span");
                const isPaid = item.pagado === true;
                badge.className = `status-badge ${isPaid ? "status-paid" : "status-pending"}`;
                badge.textContent = isPaid ? "Matriculado" : "Pago Pendiente";
                badge.setAttribute("aria-label", `Estado: ${badge.textContent}`);

                const course = document.createElement("p");
                course.className = "course-level";
                course.textContent = item.idioma_nivel || "Idioma y nivel no especificados";

                const priceLabel = document.createElement("span");
                priceLabel.className = "card-price-label";
                priceLabel.textContent = "Valor del curso";

                const price = document.createElement("strong");
                price.className = "card-price";
                price.textContent = money(item.valor_curso);

                topLine.append(name, badge);
                content.append(topLine, course, priceLabel, price);
                card.append(image, content);
                cardContainer.append(card);
            });
        }

        async function loadRecords() {
            catalogFeedback.textContent = "";
            recordCount.textContent = "Cargando...";
            try {
                const records = await api("/matriculas");
                if (!Array.isArray(records)) {
                    throw new Error("La API devolvió un formato de matrículas no válido.");
                }
                window.todosLosRegistros = records;
                renderCards();
            } catch (error) {
                console.error(error);
                recordCount.textContent = "No disponible";
                catalogFeedback.textContent =
                    `No fue posible cargar las matrículas: ${error.message}`;
            }
        }

        document.querySelectorAll("[data-filter]").forEach(button => {
            button.addEventListener("click", () => {
                closeForm();
                setActiveFilter(button.dataset.filter);
                renderCards();
            });
        });

        document.getElementById("open-form").addEventListener("click", event => {
            setFormEnabled(true);
            formSection.hidden = false;
            catalogSection.hidden = true;
            event.currentTarget.classList.add("active");
            filterButtons.forEach(button => {
                button.classList.remove("active");
                button.setAttribute("aria-pressed", "false");
            });
            form.querySelector("input").focus();
        });

        document.getElementById("cancel-form").addEventListener("click", closeForm);

        imageInput.addEventListener("input", () => {
            const value = imageInput.value.trim();
            if (!value || !imageInput.validity.valid) {
                previewWrap.hidden = true;
                previewImage.removeAttribute("src");
                return;
            }

            previewImage.src = value;
            previewWrap.hidden = false;
        });

        previewImage.addEventListener("error", () => {
            previewWrap.hidden = true;
        });

        form.addEventListener("submit", async event => {
            event.preventDefault();
            if (!form.reportValidity()) return;

            const submitButton = document.getElementById("save-form");
            const data = {
                estudiante: document.getElementById("estudiante").value.trim(),
                idioma_nivel: document.getElementById("idioma-nivel").value.trim(),
                valor_curso: Number(document.getElementById("valor-curso").value),
                pagado: document.getElementById("pagado").value === "true",
                imagen_url: imageInput.value.trim()
            };

            submitButton.disabled = true;
            formFeedback.textContent = "";
            try {
                await api("/matriculas", {
                    method: "POST",
                    body: JSON.stringify(data)
                });
                closeForm();
                await loadRecords();
            } catch (error) {
                console.error(error);
                formFeedback.textContent =
                    `No fue posible guardar la matrícula: ${error.message}`;
                submitButton.disabled = false;
            }
        });

        await loadRecords();
    }

    async function loadDashboard() {
        try {
            const [students, enrollments] = await Promise.all([
                store.getStudents(),
                store.getEnrollments()
            ]);

            document.getElementById("stat-students").textContent = students.length;
            document.getElementById("stat-enrollments").textContent = enrollments.length;
            document.getElementById("stat-pending").textContent = enrollments.filter(
                enrollment => !enrollment.pagado
            ).length;

            document.getElementById("stat-paid").textContent = money(
                enrollments
                    .filter(enrollment => enrollment.pagado)
                    .reduce(
                        (total, enrollment) => total + Number(enrollment.valor_curso || 0),
                        0
                    )
            );

            const body = document.getElementById("recent-enrollments");
            const recent = [...enrollments].slice(-5).reverse();

            body.innerHTML = recent.length
                ? recent.map(enrollment => `
                    <tr>
                        <td>
                            <span class="student-name">
                                ${esc(enrollment.estudiante_nombre || enrollment.estudiante || "Sin nombre")}
                            </span>
                        </td>
                        <td>
                            ${esc(enrollment.idioma || "")} · ${esc(enrollment.idioma_nivel || "")}
                        </td>
                        <td>${money(enrollment.valor_curso)}</td>
                        <td>${status(enrollment.pagado)}</td>
                    </tr>
                `).join("")
                : `
                    <tr>
                        <td colspan="4" class="empty-cell">
                            Aún no hay matrículas registradas.
                        </td>
                    </tr>
                `;
        } catch (error) {
            console.error(error);
            toast(`No fue posible cargar el panel: ${error.message}`);
        }
    }

    function status(paid) {
        return paid
            ? '<span class="status status-paid">● Pagado</span>'
            : '<span class="status status-pending">● Pendiente</span>';
    }

    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[character]));
    }

    window.GS.status = status;
    window.GS.esc = esc;
})();