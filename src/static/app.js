document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginToggle = document.getElementById("login-toggle");
  const loginModal = document.getElementById("login-modal");
  const closeLoginButton = document.getElementById("close-login");
  const loginForm = document.getElementById("login-form");
  const userBadge = document.getElementById("user-badge");
  const adminNote = document.getElementById("admin-note");

  let authToken = localStorage.getItem("teacherToken") || "";
  let currentTeacher = localStorage.getItem("teacherName") || "";

  function setMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    const isLoggedIn = Boolean(authToken && currentTeacher);
    signupForm.querySelectorAll("input, select, button[type='submit']").forEach((element) => {
      element.disabled = !isLoggedIn;
    });

    adminNote.textContent = isLoggedIn
      ? `Logged in as ${currentTeacher}. You can manage registrations.`
      : "Log in as a teacher to register or remove students.";

    loginToggle.textContent = isLoggedIn ? "🚪 Log Out" : "🔐 Staff Login";
    userBadge.textContent = isLoggedIn ? `Teacher: ${currentTeacher}` : "";
    userBadge.classList.toggle("hidden", !isLoggedIn);
  }

  function openLoginModal() {
    loginModal.classList.remove("hidden");
    loginModal.setAttribute("aria-hidden", "false");
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginModal.setAttribute("aria-hidden", "true");
    loginForm.reset();
  }

  async function checkExistingSession() {
    if (!authToken) {
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/admin/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        authToken = "";
        currentTeacher = "";
        localStorage.removeItem("teacherToken");
        localStorage.removeItem("teacherName");
      } else {
        const result = await response.json();
        currentTeacher = result.teacher;
        localStorage.setItem("teacherName", currentTeacher);
      }
    } catch (error) {
      authToken = "";
      currentTeacher = "";
      localStorage.removeItem("teacherToken");
      localStorage.removeItem("teacherName");
    }

    updateAuthUI();
  }

  async function submitLogin(username, password) {
    try {
      const response = await fetch("/admin/login?username=" + encodeURIComponent(username) + "&password=" + encodeURIComponent(password), {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Invalid teacher credentials");
      }

      authToken = result.token;
      currentTeacher = result.teacher;
      localStorage.setItem("teacherToken", authToken);
      localStorage.setItem("teacherName", currentTeacher);
      updateAuthUI();
      closeLoginModal();
      setMessage(`Logged in as ${currentTeacher}.`, "success");
    } catch (error) {
      setMessage(error.message || "Login failed.", "error");
    }
  }

  async function logout() {
    if (!authToken) {
      return;
    }

    try {
      await fetch("/admin/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    } catch (error) {
      console.error("Logout failed", error);
    }

    authToken = "";
    currentTeacher = "";
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherName");
    updateAuthUI();
    setMessage("Logged out successfully.", "success");
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const registrationAllowed = Boolean(authToken);

        const participantsHTML = details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => `
                    <li>
                      <span class="participant-email">${email}</span>
                      ${registrationAllowed ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ""}
                    </li>
                  `)
                  .join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!authToken) {
      setMessage("Please log in as a teacher before making changes.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authToken) {
      setMessage("Please log in as a teacher before registering students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginToggle.addEventListener("click", () => {
    if (authToken) {
      logout();
      return;
    }
    openLoginModal();
  });

  closeLoginButton.addEventListener("click", closeLoginModal);

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModal();
    }
  });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      setMessage("Please enter both username and password.", "error");
      return;
    }

    submitLogin(username, password);
  });

  updateAuthUI();
  checkExistingSession();
  fetchActivities();
});
