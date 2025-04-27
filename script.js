// === 5: MAIN APPLICATION SCRIPT START ===

// === 5.1: GLOBAL VARIABLES & STATE START ===
let projectData = null; // To hold data from project_data.json
let userData = null;    // To hold data from users_roles.json
let tasks = [];         // Array of task objects, processed from projectData
let users = [];         // Array of user objects
let roles = [];         // Array of role objects
let currentUser = null; // The currently selected user object
let currentView = 'dashboard'; // The currently active view ID
let notifications = []; // Simple array to simulate notifications

// DOM Element References (cached for performance)
const userSelect = document.getElementById('userSelect');
const appContent = document.getElementById('appContent');
const navButtons = document.querySelectorAll('.nav-button');
const projectStatusEl = document.getElementById('projectStatus');
const projectEtaEl = document.getElementById('projectEta');
const progressBarEl = document.getElementById('progressBar');
const progressPercentageEl = document.getElementById('progressPercentage');
const activeTasksListEl = document.getElementById('activeTasksList');
const latestNotificationsListEl = document.getElementById('latestNotificationsList');
const fullTaskListContainerEl = document.getElementById('fullTaskListContainer');
const myTasksListContainerEl = document.getElementById('myTasksListContainer');
const phaseFilterEl = document.getElementById('phaseFilter');
const statusFilterEl = document.getElementById('statusFilter');
const taskDetailViewEl = document.getElementById('taskDetail');
const taskDetailContentEl = document.getElementById('taskDetailContent');
const backToListButton = document.getElementById('backToListButton');
const userListBodyEl = document.getElementById('userListBody');
const waitingForListEl = document.getElementById('waitingForList');
const waitingOnMeListEl = document.getElementById('waitingOnMeList');
const newMessageButton = document.getElementById('new-message-button');
const newMessageModal = document.getElementById('newMessageModal');
const messageRecipientEl = document.getElementById('messageRecipient');
const messageSubjectEl = document.getElementById('messageSubject');
const messageBodyEl = document.getElementById('messageBody');
const sendMessageButton = document.getElementById('sendMessageButton');
const cancelMessageButton = document.getElementById('cancelMessageButton');
const messageListContainerEl = document.getElementById('messageListContainer');
// === 5.1: GLOBAL VARIABLES & STATE END ===


// === 5.2: INITIALIZATION FUNCTIONS START ===
/**
 * Helper function to remove single-line comments (//) from a JSON string.
 * @param {string} jsonString - The raw string content from the file.
 * @returns {string} - The JSON string with comments removed.
 */
function removeJsonComments(jsonString) {
    // Split into lines, filter out comment lines, join back
    return jsonString.split('\n')
        .filter(line => !line.trim().startsWith('//'))
        .join('\n');
}

/**
 * Fetches data from JSON files, handling potential comments.
 */
async function loadData() {
    try {
        const [projectResponse, userResponse] = await Promise.all([
            fetch('project_data.json'),
            fetch('users_roles.json')
        ]);

        if (!projectResponse.ok || !userResponse.ok) {
            // Display specific error messages if fetch failed
            let errorMsg = 'Kunne ikke laste prosjektdata. ';
            if (!projectResponse.ok) {
                 errorMsg += `Feil ved henting av project_data.json (Status: ${projectResponse.status}). `;
            }
            if (!userResponse.ok) {
                 errorMsg += `Feil ved henting av users_roles.json (Status: ${userResponse.status}).`;
            }
            throw new Error(errorMsg);
        }

        // Get text content first
        const projectText = await projectResponse.text();
        const userText = await userResponse.text();

        // Remove comments and then parse
        projectData = JSON.parse(removeJsonComments(projectText));
        userData = JSON.parse(removeJsonComments(userText));

        console.log("Data loaded and parsed successfully:", { projectData, userData });

        // Process data after loading
        processLoadedData();

    } catch (error) {
        console.error('Error loading or parsing data:', error);
        // Display a more user-friendly error message
        let displayError = 'Kunne ikke laste prosjektdata. ';
        if (error instanceof SyntaxError) {
            displayError += 'Det er en feil i formatet til en av JSON-filene (etter fjerning av kommentarer). Sjekk konsollen for detaljer.';
        } else {
            displayError += ` (${error.message}). Sjekk at filene er tilgjengelige og korrekt formatert.`;
        }
         appContent.innerHTML = `<p style="color: red; padding: 20px;">${displayError}</p>`;
         // Optionally hide the loading indicator in the user select dropdown
         userSelect.innerHTML = '<option value="">Feil ved lasting</option>';
    }
}


/**
 * Processes the raw data loaded from JSON into usable arrays and objects.
 */
function processLoadedData() {
    if (!projectData || !userData) return;

    tasks = projectData.tasks.map(task => ({
        ...task,
        // Convert prerequisite numbers to actual task IDs for easier lookup
        ForutsetningerIDs: task.Forutsetninger.map(nr => `TASK-${String(nr).padStart(3, '0')}`),
        // Initialize date objects (null for now, could parse strings if they exist)
        BeregnetStartDato: task.BeregnetStartDato ? new Date(task.BeregnetStartDato) : null,
        BeregnetSluttDato: task.BeregnetSluttDato ? new Date(task.BeregnetSluttDato) : null,
        FaktiskStartDato: task.FaktiskStartDato ? new Date(task.FaktiskStartDato) : null,
        FaktiskSluttDato: task.FaktiskSluttDato ? new Date(task.FaktiskSluttDato) : null,
        // Add fields for new features
        GodkjentAvLeder: false, // For double sign-off
        ProblemBeskrivelse: null // For "Nødbrems"
    }));

    roles = userData.roles;
    users = userData.users;

    // Set initial user (e.g., the first user or the project leader)
    const projectLeader = users.find(u => u.RolleIDs.includes('ROLLE-PL')) || users[0];
    if (projectLeader) {
        currentUser = projectLeader;
    }

    // Populate UI elements that depend on loaded data
    populateUserSelector();
    populatePhaseFilter();
    populateMessageRecipientSelector(); // Populate recipient list
}

/**
 * Populates the global user selector dropdown.
 */
function populateUserSelector() {
    if (!users || users.length === 0) {
         userSelect.innerHTML = '<option value="">Ingen brukere</option>'; // Handle case with no users
        return;
    }
    userSelect.innerHTML = ''; // Clear existing options ("Laster brukere...")
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.BrukerID;
        option.textContent = `${user.Navn} (${getRolesForUser(user).map(r => r.RolleNavn).join(', ')})`;
        userSelect.appendChild(option);
    });
    // Set the selected value based on currentUser
    if (currentUser) {
        userSelect.value = currentUser.BrukerID;
    }
}

/**
 * Populates the phase filter dropdown.
 */
function populatePhaseFilter() {
    const phases = [...new Set(tasks.map(task => task.Fase))]; // Get unique phases
    phaseFilterEl.innerHTML = '<option value="all">Alle Faser</option>'; // Reset
    phases.sort(); // Sort phases alphabetically/numerically
    phases.forEach(phase => {
        const option = document.createElement('option');
        option.value = phase;
        option.textContent = phase;
        phaseFilterEl.appendChild(option);
    });
}

/**
 * Populates the recipient selector in the new message modal.
 */
 function populateMessageRecipientSelector() {
    if (!users) return;
    messageRecipientEl.innerHTML = ''; // Clear existing
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.BrukerID;
        option.textContent = user.Navn;
        messageRecipientEl.appendChild(option);
    });
    // Optionally add roles? For PoC, sending to users is simpler.
}


/**
 * Main initialization function called on page load.
 */
async function init() {
    console.log("Initializing application...");
    setupEventListeners();
    await loadData(); // Load data first
    if (projectData && userData) { // Ensure data is loaded before rendering
        renderApp(); // Initial render
    } else {
         console.log("Initialization halted due to data loading failure.");
         // Error message is already displayed by loadData() in case of failure
    }
}
// === 5.2: INITIALIZATION FUNCTIONS END ===


// === 5.3: RENDERING FUNCTIONS START ===

/**
 * Main render function to update the entire UI based on current state.
 */
function renderApp() {
    // Added check: Do not proceed if data is missing
    if (!projectData || !userData || !currentUser) {
        console.log("Render blocked: Missing data or currentUser.");
        // Ensure the error message remains visible if needed
        if (!document.querySelector('#appContent p[style*="color: red;"]')) {
             appContent.innerHTML = '<p style="color: orange; padding: 20px;">Kan ikke vise data. Prøv å laste siden på nytt.</p>';
        }
        return; // Stop rendering
    }
     // Clear potential error messages if rendering proceeds
    const errorMsgElement = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]');
    if (errorMsgElement) {
        errorMsgElement.remove();
    }


    console.log(`Rendering app for user: ${currentUser.Navn}, view: ${currentView}`);

    // Update all views, even hidden ones, so data is ready when switching
    renderDashboard();
    renderFullTaskList();
    renderMyTasksList();
    renderUserList();
    renderDependenciesView();
    renderMessages(); // Render messages/notifications list
    // Task Detail view is rendered on demand (when a task is clicked)

    // Activate the correct view
    switchView(currentView);

    // Update active nav button
    updateActiveNavButton();
}

/**
 * Renders the dashboard view.
 */
function renderDashboard() {
    if (!projectData) return; // Guard against missing data
    // Project Status & ETA
    projectStatusEl.textContent = projectData.project.Status; // Simple status for now
    projectEtaEl.textContent = calculateProjectEta(); // Calculate rough ETA

    // Progress Bar
    const progress = calculateProjectProgress();
    progressBarEl.style.width = `${progress}%`;
    // progressBarEl.textContent = `${progress}%`; // Optional: text inside bar
    progressPercentageEl.textContent = progress;

    // Active Tasks
    const activeTasks = tasks.filter(task => task.Status === 'Pågår');
    activeTasksListEl.innerHTML = ''; // Clear list
    if (activeTasks.length === 0) {
        activeTasksListEl.innerHTML = '<li>Ingen aktive oppgaver</li>';
    } else {
        activeTasks.slice(0, 5).forEach(task => { // Show max 5
            const li = document.createElement('li');
            const responsibleRole = getRoleById(task.AnsvarligRolleID);
            li.innerHTML = `<strong>${task.OppgaveNr}. ${task.OppgaveNavn}</strong> (${responsibleRole ? responsibleRole.RolleNavn : 'Ukjent'})`;
             // Make task name clickable to go to details
             li.querySelector('strong').style.cursor = 'pointer';
             li.querySelector('strong').onclick = () => showTaskDetail(task.OppgaveID);
            activeTasksListEl.appendChild(li);
        });
    }

    // Latest Notifications (Simulated) - Render from `notifications` array
    renderNotificationsList(latestNotificationsListEl, 5); // Show max 5 on dashboard
}


/**
 * Renders the full task list based on filters.
 */
function renderFullTaskList() {
    const phaseFilter = phaseFilterEl.value;
    const statusFilter = statusFilterEl.value;

    const filteredTasks = tasks.filter(task => {
        const phaseMatch = phaseFilter === 'all' || task.Fase === phaseFilter;
        const statusMatch = statusFilter === 'all' || task.Status === statusFilter;
        return phaseMatch && statusMatch;
    });

    fullTaskListContainerEl.innerHTML = ''; // Clear previous list
    if (filteredTasks.length === 0) {
        fullTaskListContainerEl.innerHTML = '<p>Ingen oppgaver matcher filtrene.</p>';
        return;
    }

    filteredTasks.sort((a, b) => a.OppgaveNr - b.OppgaveNr); // Sort by number

    filteredTasks.forEach(task => {
        fullTaskListContainerEl.appendChild(createTaskElement(task, true)); // Pass true for admin view
    });
}

/**
 * Renders the "My Tasks" list for the current user.
 */
function renderMyTasksList() {
    if (!currentUser) {
         myTasksListContainerEl.innerHTML = '<p>Velg en bruker for å se deres oppgaver.</p>';
        return;
    }

    const myTasks = tasks.filter(task => {
        const taskRole = getRoleById(task.AnsvarligRolleID);
        if (!taskRole) return false;
        // Check if any of the current user's roles match the task's responsible role ID
        return currentUser.RolleIDs.includes(task.AnsvarligRolleID);
    });

    myTasksListContainerEl.innerHTML = ''; // Clear previous list
    if (myTasks.length === 0) {
        myTasksListContainerEl.innerHTML = '<p>Ingen oppgaver tildelt denne rollen/brukeren.</p>';
        return;
    }

    // Sort user's tasks: Problematic first, then Ongoing, Pending Approval, Waiting, Not Started, Completed last
    myTasks.sort((a, b) => {
        const statusOrder = {
            "Problem Rapportert": 1,
            "Pågår": 2,
            "Venter på Godkjenning": 3,
            "Venter på forutsetning": 4,
            "Ikke startet": 5,
            "Utført": 6
        };
        const orderA = statusOrder[a.Status] || 99;
        const orderB = statusOrder[b.Status] || 99;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        return a.OppgaveNr - b.OppgaveNr; // Then sort by task number
    });


    myTasks.forEach(task => {
        myTasksListContainerEl.appendChild(createTaskElement(task, false)); // Pass false for non-admin view
    });
}

/**
 * Creates an HTML element representing a single task item.
 * @param {object} task - The task object.
 * @param {boolean} isAdminView - If true, show admin controls (like fast complete).
 * @returns {HTMLElement} - The created task element (div).
 */
function createTaskElement(task, isAdminView) {
    const taskElement = document.createElement('div');
    taskElement.classList.add('task-item');
    taskElement.dataset.taskId = task.OppgaveID;
    taskElement.dataset.status = task.Status; // Used for CSS styling

    const responsibleRole = getRoleById(task.AnsvarligRolleID);
    const durationText = task.EstimertVarighetDager !== null ? `${task.EstimertVarighetDager} dager` : 'Ikke estimert'; // Show 0 days

    taskElement.innerHTML = `
        <h4>${task.OppgaveNr}. ${task.OppgaveNavn}</h4>
        <div class="task-meta">
            Ansvarlig: ${responsibleRole ? responsibleRole.RolleNavn : 'Ukjent'} | Status: ${task.Status}
            ${task.Status === 'Problem Rapportert' ? `<strong style="color:var(--status-problem)"> (${task.ProblemBeskrivelse || 'Problem rapportert'})</strong>` : ''}
            ${task.Status === 'Venter på Godkjenning' ? `<strong style="color:var(--status-pending-approval)"> (Venter på ledergodkjenning)</strong>` : ''}
        </div>
        <div class="task-duration">${durationText}</div>
        <div class="task-actions">
            <button class="details-button">Detaljer</button>
            ${isAdminView && currentUser?.RolleIDs.includes('ROLLE-PL') && task.Status !== 'Utført' ?
                '<button class="admin-complete-button" title="Admin: Hurtigfullfør (inkl. godkjenning)">⚡ Fullfør</button>'
                : ''
            }
        </div>
    `;

    // Add event listeners for buttons
    taskElement.querySelector('.details-button').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering other clicks if nested
        showTaskDetail(task.OppgaveID);
    });

    const adminCompleteButton = taskElement.querySelector('.admin-complete-button');
    if (adminCompleteButton) {
        adminCompleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            adminMarkTaskComplete(task.OppgaveID);
        });
    }

    return taskElement;
}

/**
 * Renders the task detail view.
 * @param {string} taskId - The ID of the task to show details for.
 */
function showTaskDetail(taskId) {
    const task = findTaskById(taskId);
    if (!task) return;

    // Ensure the main app container doesn't show an error message
     const errorMsgElement = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]');
    if (errorMsgElement) {
        errorMsgElement.remove();
    }


    currentView = 'taskDetail'; // Set internal state, but don't call switchView yet
    taskDetailViewEl.classList.add('active-view'); // Show the detail view container

    // Hide other views manually
     document.querySelectorAll('.view:not(#taskDetail)').forEach(v => v.classList.remove('active-view'));


    const responsibleRole = getRoleById(task.AnsvarligRolleID);
    const responsibleUsers = findUsersByRole(task.AnsvarligRolleID);

    let prerequisitesHtml = 'Ingen';
    if (task.ForutsetningerIDs && task.ForutsetningerIDs.length > 0) {
        prerequisitesHtml = '<ul>';
        task.ForutsetningerIDs.forEach(preReqId => {
            const preReqTask = findTaskById(preReqId);
            if (preReqTask) {
                const statusIcon = preReqTask.Status === 'Utført' ? '✅' : (preReqTask.Status === 'Pågår' ? '⏳' : '⚪');
                prerequisitesHtml += `<li>${statusIcon} ${preReqTask.OppgaveNr}. ${preReqTask.OppgaveNavn} (${preReqTask.Status})</li>`;
            } else {
                prerequisitesHtml += `<li>Ukjent forutsetning (ID: ${preReqId})</li>`;
            }
        });
        prerequisitesHtml += '</ul>';
    }

     let successorsHtml = 'Ingen';
     const successorTasks = tasks.filter(t => t.ForutsetningerIDs?.includes(task.OppgaveID));
     if (successorTasks.length > 0) {
         successorsHtml = '<ul>';
         successorTasks.forEach(succTask => {
             successorsHtml += `<li>${succTask.OppgaveNr}. ${succTask.OppgaveNavn} (${succTask.Status})</li>`;
         });
         successorsHtml += '</ul>';
     }

    let actionButtonsHtml = generateActionButtons(task);


    taskDetailContentEl.innerHTML = `
        <h3>Generell Informasjon</h3>
        <p><strong>Fase:</strong> ${task.Fase}</p>
        <p><strong>Beskrivelse:</strong> ${task.Beskrivelse || 'Ingen beskrivelse.'}</p>
        <p>
            <strong>Ansvarlig Rolle:</strong> ${responsibleRole ? responsibleRole.RolleNavn : 'Ukjent'}
        </p>
        <p>
            <strong>Ansvarlig(e) Bruker(e):</strong>
            ${responsibleUsers.length > 0 ? responsibleUsers.map(u => `<span class="clickable-user" data-user-id="${u.BrukerID}">${u.Navn}</span>`).join(', ') : 'Ingen brukere funnet'}
        </p>

        <h3>Status & Tidsplan</h3>
        <p><strong>Nåværende Status:</strong> ${task.Status}</p>
        ${task.Status === 'Problem Rapportert' ? `<p style="color:var(--status-problem)"><strong>Problem:</strong> ${task.ProblemBeskrivelse || 'Problem rapportert'}</p>` : ''}
        ${task.Status === 'Venter på Godkjenning' ? `<p style="color:var(--status-pending-approval)"><strong>Venter på godkjenning fra Prosjektleder.</strong></p>` : ''}

        <p><strong>Estimert Varighet:</strong>
           <input type="number" id="durationInput_${task.OppgaveID}" value="${task.EstimertVarighetDager !== null ? task.EstimertVarighetDager : ''}" min="0" step="1" ${canEditDuration(task) ? '' : 'disabled'} style="width: 60px; margin-left: 5px;"> dager
           ${canEditDuration(task) ? `<button class="save-duration-button" data-task-id="${task.OppgaveID}">Lagre</button>` : ''}
        </p>
        <p><strong>Beregnet Start:</strong> ${formatDate(task.BeregnetStartDato)}</p>
        <p><strong>Beregnet Slutt:</strong> ${formatDate(task.BeregnetSluttDato)}</p>
        <p><strong>Faktisk Start:</strong> ${formatDate(task.FaktiskStartDato)}</p>
        <p><strong>Faktisk Slutt:</strong> ${formatDate(task.FaktiskSluttDato)}</p>

        <div class="task-detail-actions">
            ${actionButtonsHtml}
        </div>

        <h3>Avhengigheter</h3>
        <p><strong>Forutsetninger (Må være ferdig først):</strong></p>
        ${prerequisitesHtml}
        <p><strong>Etterfølgende Oppgaver (Venter på denne):</strong></p>
        ${successorsHtml}

        <h3>Kommunikasjon (Simulert)</h3>
        <textarea id="taskCommentInput" placeholder="Legg til notat/melding knyttet til oppgaven..."></textarea>
        <button id="addTaskCommentButton">Legg til Notat</button>
        <ul id="taskCommentsList">
            <!-- Comments/messages related to this task would go here -->
            <li>Ingen notater ennå.</li>
        </ul>

         <!-- Add user selector specific to this task detail view -->
         <div class="user-selector task-detail-user-selector" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--gray-medium);">
            <label for="taskDetailUserSelect">Vis denne oppgaven som:</label>
            <select id="taskDetailUserSelect">
                <!-- Options populated like the main selector -->
            </select>
        </div>
    `;

    // Populate the task-specific user selector
    populateTaskDetailUserSelector(taskId);


    // Add event listeners for dynamically created elements
    addTaskDetailEventListeners(task);
}

/**
 * Populates the user selector within the task detail view.
 * @param {string} taskId
 */
 function populateTaskDetailUserSelector(taskId) {
    const taskDetailSelect = document.getElementById('taskDetailUserSelect');
    if (!taskDetailSelect || !users) return;

    taskDetailSelect.innerHTML = ''; // Clear
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.BrukerID;
        option.textContent = `${user.Navn} (${getRolesForUser(user).map(r => r.RolleNavn).join(', ')})`;
        taskDetailSelect.appendChild(option);
    });

    // Set the selected value based on the global currentUser
    if (currentUser) {
        taskDetailSelect.value = currentUser.BrukerID;
    }

    // Add event listener specific to this select dropdown
    taskDetailSelect.removeEventListener('change', handleTaskDetailUserChange); // Remove previous if any
    taskDetailSelect.addEventListener('change', handleTaskDetailUserChange);
}


/**
 * Renders the user list table.
 */
function renderUserList() {
    userListBodyEl.innerHTML = ''; // Clear table body
    if (!users || users.length === 0) {
        userListBodyEl.innerHTML = '<tr><td colspan="4">Ingen brukere funnet.</td></tr>';
        return;
    }
    users.forEach(user => {
        const userRoles = getRolesForUser(user).map(r => r.RolleNavn).join(', ');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.Navn}</td>
            <td>${userRoles}</td>
            <td>${user.Firma}</td>
            <td>${user.Epost} | ${user.Telefon}</td>
        `;
        userListBodyEl.appendChild(tr);
    });
}

/**
 * Renders the Dependencies view for the current user.
 */
function renderDependenciesView() {
     if (!currentUser) {
        waitingForListEl.innerHTML = '<li>Velg en bruker for å se avhengigheter.</li>';
        waitingOnMeListEl.innerHTML = '<li>Velg en bruker for å se avhengigheter.</li>';
        return;
    }

    // --- What am I waiting for? ---
    waitingForListEl.innerHTML = '';
    const myWaitingTasks = tasks.filter(task =>
        currentUser.RolleIDs.includes(task.AnsvarligRolleID) &&
        (task.Status === 'Ikke startet' || task.Status === 'Venter på forutsetning')
    );

    let waitingFound = false;
    myWaitingTasks.forEach(myTask => {
        const unmetPrerequisites = myTask.ForutsetningerIDs.map(findTaskById).filter(preReq => preReq && preReq.Status !== 'Utført');
        if (unmetPrerequisites.length > 0) {
            waitingFound = true;
            const li = document.createElement('li');
            li.innerHTML = `For å starte <strong>${myTask.OppgaveNr}. ${myTask.OppgaveNavn}</strong>, venter du på:
                <ul>${unmetPrerequisites.map(preReq => `<li>${preReq.OppgaveNr}. ${preReq.OppgaveNavn} (Status: ${preReq.Status})</li>`).join('')}</ul>`;
            waitingForListEl.appendChild(li);
        }
    });
    if (!waitingFound) {
        waitingForListEl.innerHTML = '<li>Du venter ikke på noen spesifikke uferdige forutsetninger for dine tildelte oppgaver.</li>';
    }


    // --- Who is waiting for me? ---
    waitingOnMeListEl.innerHTML = '';
    const myActiveOrPendingTasks = tasks.filter(task =>
        currentUser.RolleIDs.includes(task.AnsvarligRolleID) &&
        (task.Status !== 'Utført') // Tasks I am working on or need to do
    );

    let waitingOnMeFound = false;
    myActiveOrPendingTasks.forEach(myTask => {
        const successorTasksWaiting = tasks.filter(succTask =>
            succTask.ForutsetningerIDs?.includes(myTask.OppgaveID) &&
            (succTask.Status === 'Ikke startet' || succTask.Status === 'Venter på forutsetning')
        );

        if (successorTasksWaiting.length > 0) {
            waitingOnMeFound = true;
            const li = document.createElement('li');
            const successorRoles = [...new Set(successorTasksWaiting.map(st => getRoleById(st.AnsvarligRolleID)?.RolleNavn || 'Ukjent'))];
            li.innerHTML = `Fordi <strong>${myTask.OppgaveNr}. ${myTask.OppgaveNavn}</strong> (Status: ${myTask.Status}) ikke er utført, venter:
                <ul>${successorTasksWaiting.map(st => `<li>${st.OppgaveNr}. ${st.OppgaveNavn} (${getRoleById(st.AnsvarligRolleID)?.RolleNavn || 'Ukjent'})</li>`).join('')}</ul>
                (Roller: ${successorRoles.join(', ')})`;
            waitingOnMeListEl.appendChild(li);
        }
    });
     if (!waitingOnMeFound) {
        waitingOnMeListEl.innerHTML = '<li>Ingen andre oppgaver ser ut til å vente spesifikt på at dine nåværende oppgaver skal bli ferdige.</li>';
    }
}

/**
 * Renders the simulated messages/notifications list.
 * @param {HTMLElement} targetListElement - The UL element to render into.
 * @param {number} [maxItems=null] - Maximum number of items to display (null for all).
 */
 function renderMessages(targetListElement = messageListContainerEl, maxItems = null) {
    targetListElement.innerHTML = ''; // Clear list

    if (notifications.length === 0) {
        targetListElement.innerHTML = '<li>Ingen meldinger eller varsler.</li>';
        return;
    }

    // Sort notifications newest first
    const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp);
    const itemsToRender = maxItems ? sortedNotifications.slice(0, maxItems) : sortedNotifications;

    itemsToRender.forEach(notif => {
        const li = document.createElement('li');
        let content = '';
        if (notif.type === 'message') {
             const sender = findUserById(notif.senderId);
             const recipient = findUserById(notif.recipientId);
            content = `
                <strong>Melding fra: ${sender ? sender.Navn : 'Ukjent'} til ${recipient ? recipient.Navn : 'Ukjent'}</strong>
                <small>${formatDate(notif.timestamp, true)}</small>
                <p><em>${notif.subject || '(Intet emne)'}</em></p>
                <p>${notif.body}</p>`;
        } else if (notif.type === 'system') {
             content = `
                <strong>Systemvarsel</strong>
                <small>${formatDate(notif.timestamp, true)}</small>
                <p>${notif.body}</p>`;
        } else {
            content = `
                <strong>Ukjent varsel</strong>
                 <small>${formatDate(notif.timestamp, true)}</small>
                <p>${notif.body}</p>`;
        }
        li.innerHTML = content;
        targetListElement.appendChild(li);
    });
}

/**
 * Renders just the notifications list (used by dashboard and message view).
 */
function renderNotificationsList(targetListElement, maxItems = null) {
    targetListElement.innerHTML = ''; // Clear list

    if (notifications.length === 0) {
        targetListElement.innerHTML = '<li>Ingen nye hendelser.</li>';
        return;
    }

    // Sort notifications newest first
    const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp);
    const itemsToRender = maxItems ? sortedNotifications.slice(0, maxItems) : sortedNotifications;

    itemsToRender.forEach(notif => {
        const li = document.createElement('li');
        li.innerHTML = `<small>${formatDate(notif.timestamp, true)}:</small> ${notif.body}`;
        // Make clickable if related to a task?
        if (notif.taskId) {
            li.style.cursor = 'pointer';
            li.onclick = () => showTaskDetail(notif.taskId);
        }
        targetListElement.appendChild(li);
    });
}

/**
 * Generates the HTML for action buttons in the task detail view
 * based on task status and current user role.
 * @param {object} task - The task object.
 * @returns {string} HTML string for the buttons.
 */
function generateActionButtons(task) {
    let buttonsHtml = '';
     // Add null check for currentUser
    if (!currentUser) return buttonsHtml;

    const isProjectLeader = currentUser.RolleIDs.includes('ROLLE-PL');
    const isResponsibleUser = currentUser.RolleIDs.includes(task.AnsvarligRolleID);

    // --- Actions for Responsible User ---
    if (isResponsibleUser) {
        if (task.Status === 'Ikke startet' || task.Status === 'Venter på forutsetning') {
            const canStart = arePrerequisitesMet(task);
            buttonsHtml += `<button class="start-task-button" data-task-id="${task.OppgaveID}" ${!canStart ? 'disabled title="Forutsetninger ikke møtt"' : ''}>Start Arbeid</button>`;
        }
        if (task.Status === 'Pågår') {
             buttonsHtml += `<button class="complete-task-button" data-task-id="${task.OppgaveID}">Marker som Utført (Send til godkjenning)</button>`;
        }
         // Problem button always available for responsible user if task is not 'Utført'
        if (task.Status !== 'Utført' && task.Status !== 'Problem Rapportert') {
             buttonsHtml += `<button class="problem-button" data-task-id="${task.OppgaveID}">Rapporter Problem (Nødbrems)</button>`;
        }
    }

    // --- Actions for Project Leader ---
    if (isProjectLeader) {
         if (task.Status === 'Venter på Godkjenning') {
            buttonsHtml += `<button class="approve-button" data-task-id="${task.OppgaveID}">Godkjenn Utført Arbeid</button>`;
            buttonsHtml += `<button class="reject-button" data-task-id="${task.OppgaveID}">Avvis (Send tilbake til 'Pågår')</button>`; // Added reject button
         }
         if (task.Status === 'Problem Rapportert') {
             buttonsHtml += `<button class="resolve-problem-button" data-task-id="${task.OppgaveID}">Marker Problem som Løst</button>`;
         }
         // Admin fast complete button (could also be added here, but handled in task list element for PoC simplicity)
    }

    return buttonsHtml;
}

// === 5.3: RENDERING FUNCTIONS END ===


// === 5.4: EVENT HANDLERS START ===

/**
 * Sets up all initial event listeners.
 */
function setupEventListeners() {
    // User selection change
    userSelect.addEventListener('change', handleUserChange);

    // Navigation button clicks
    navButtons.forEach(button => {
        button.addEventListener('click', handleNavClick);
    });

    // Filter changes
    phaseFilterEl.addEventListener('change', renderFullTaskList);
    statusFilterEl.addEventListener('change', renderFullTaskList);

     // Back button from task detail
    backToListButton.addEventListener('click', () => {
        // Determine which list view was active before showing detail?
        // For simplicity in PoC, always go back to 'Alle Oppgaver' or 'Mine Oppgaver' based on user.
         if (!currentUser) return; // Add guard clause

        const prevView = currentUser.RolleIDs.includes('ROLLE-PL') ? 'taskList' : 'myTasks';
        switchView(prevView); // Go back to a list view
        renderApp(); // Re-render to ensure lists are updated
    });

    // New Message button and modal actions
    newMessageButton.addEventListener('click', () => {
        newMessageModal.style.display = 'block';
        // Pre-fill recipient? Maybe not needed.
         messageSubjectEl.value = '';
         messageBodyEl.value = '';
    });

    cancelMessageButton.addEventListener('click', () => {
        newMessageModal.style.display = 'none';
    });

    sendMessageButton.addEventListener('click', handleSendMessage);


    // Event delegation for dynamically created elements inside taskDetailContent
    taskDetailContentEl.addEventListener('click', handleTaskDetailClicks);

}

/**
 * Handles clicks within the task detail view using event delegation.
 * @param {Event} event - The click event.
 */
function handleTaskDetailClicks(event) {
     if (!currentUser) return; // Add guard clause

    const target = event.target;
    const taskId = target.dataset.taskId;
    const currentTaskInDetail = findTaskById(taskDetailViewEl.querySelector('.save-duration-button')?.dataset.taskId); // Find current task ID reliably


    // Button clicks
    if (target.classList.contains('start-task-button') && taskId) {
        updateTaskStatus(taskId, 'Pågår');
    } else if (target.classList.contains('complete-task-button') && taskId) {
        updateTaskStatus(taskId, 'Venter på Godkjenning');
    } else if (target.classList.contains('approve-button') && taskId) {
        updateTaskStatus(taskId, 'Utført', { godkjent: true });
    } else if (target.classList.contains('reject-button') && taskId) {
        updateTaskStatus(taskId, 'Pågår');
        addNotification('system', `Oppgave ${findTaskById(taskId)?.OppgaveNr} ble avvist av leder og satt tilbake til 'Pågår'.`, null, taskId);
    } else if (target.classList.contains('problem-button') && taskId) {
        reportProblem(taskId);
    } else if (target.classList.contains('resolve-problem-button') && taskId) {
        resolveProblem(taskId);
    } else if (target.classList.contains('save-duration-button') && taskId) {
        handleSaveDuration(taskId);
    } else if (target.id === 'addTaskCommentButton') {
         const commentInput = document.getElementById('taskCommentInput');
         if (commentInput && commentInput.value.trim() !== '' && currentTaskInDetail) {
             addNotification('system', `Notat lagt til Oppgave ${currentTaskInDetail.OppgaveNr}: "${commentInput.value.trim()}"`, currentUser.BrukerID, currentTaskInDetail.OppgaveID);
             commentInput.value = '';
             // Re-render messages? Or add dynamically? For now, rely on next full render.
             // Maybe re-render just the message part of the detail view?
             renderMessages(); // Re-render main message list and dashboard notification list
         }
    }
     // Clickable user spans for role switching
     else if (target.classList.contains('clickable-user') && target.dataset.userId) {
        const userIdToSwitch = target.dataset.userId;
        const userToSwitch = findUserById(userIdToSwitch);
        if (userToSwitch && currentTaskInDetail) {
            currentUser = userToSwitch;
            userSelect.value = currentUser.BrukerID; // Update global selector
            // Re-render the task detail view immediately with the new user's perspective
            showTaskDetail(currentTaskInDetail.OppgaveID); // Use the reliably found task ID
            addNotification('system', `Visning byttet til bruker: ${currentUser.Navn}`, null); // Notify about user switch
        }
    }
}


/**
 * Handles changes in the global user selector.
 */
function handleUserChange() {
    const selectedUserId = userSelect.value;
    currentUser = findUserById(selectedUserId);
     if (!currentUser) {
        console.error("Selected user not found!");
        return; // Prevent further errors
    }

    console.log("User changed to:", currentUser.Navn);
    addNotification('system', `Visning byttet til bruker: ${currentUser.Navn}`, null);
    // Determine default view based on role
    currentView = currentUser.RolleIDs.includes('ROLLE-PL') ? 'dashboard' : 'myTasks';
    renderApp(); // Re-render the entire app for the new user
}

/**
 * Handles changes in the task detail user selector.
 */
function handleTaskDetailUserChange(event) {
    const selectedUserId = event.target.value; // Get value from the task detail select
    const userToSwitch = findUserById(selectedUserId);
    const currentTaskInDetail = findTaskById(taskDetailViewEl.querySelector('.save-duration-button')?.dataset.taskId); // Find current task ID

    if (userToSwitch && currentTaskInDetail) {
        currentUser = userToSwitch;
        userSelect.value = currentUser.BrukerID; // Update global selector as well for consistency

        // Re-render the task detail view for the new user
        showTaskDetail(currentTaskInDetail.OppgaveID);
        addNotification('system', `Visning byttet til bruker: ${currentUser.Navn}`, null); // Notify about user switch
    }
}


/**
 * Handles clicks on the main navigation buttons.
 */
function handleNavClick(event) {
    const targetView = event.target.dataset.targetView;
    if (targetView) {
        currentView = targetView;
        // Ensure data is present before switching/rendering
        if (projectData && userData) {
            switchView(targetView);
            updateActiveNavButton();
            // Optionally, re-render specific views if needed upon navigation
            if (targetView === 'messages') {
                renderMessages(); // Ensure full message list is rendered
            }
        } else {
            // Handle case where user clicks nav before data is loaded
            console.warn("Navigation attempt before data is loaded.");
             // Maybe show the error message if it exists?
            const errorMsgElement = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]');
             if (!errorMsgElement) {
                appContent.innerHTML = '<p style="color: orange; padding: 20px;">Data lastes fortsatt eller en feil har oppstått. Prøv igjen om et øyeblikk.</p>';
             }
        }
    }
}

/**
 * Handles saving the duration for a task.
 * @param {string} taskId - The ID of the task.
 */
function handleSaveDuration(taskId) {
    const task = findTaskById(taskId);
    const inputElement = document.getElementById(`durationInput_${taskId}`);
    if (!task || !inputElement) return;

    const newDurationString = inputElement.value;
     // Allow empty input to represent null/clear the duration
    const newDuration = newDurationString === '' ? null : parseInt(newDurationString, 10);

    if (newDurationString === '' || (!isNaN(newDuration) && newDuration >= 0)) {
        if (task.EstimertVarighetDager !== newDuration) {
            const oldDuration = task.EstimertVarighetDager;
            task.EstimertVarighetDager = newDuration;
            console.log(`Duration updated for task ${taskId} to ${newDuration === null ? 'null' : newDuration} days.`);
            // Add notification
            addNotification('system', `Varighet for Oppgave ${task.OppgaveNr} endret fra ${oldDuration === null ? 'N/A' : oldDuration} til ${newDuration === null ? 'N/A' : newDuration} dager av ${currentUser.Navn}.`, currentUser.BrukerID, taskId);

            // Recalculate dates (simplified for PoC)
            recalculateTaskDates(task);

            // Re-render relevant parts of the UI
            renderApp(); // Full re-render to update dashboard, lists, etc.
            showTaskDetail(taskId); // Show updated detail view
        }
    } else {
        alert("Vennligst skriv inn et gyldig positivt tall for varighet, eller la feltet stå tomt.");
        inputElement.value = task.EstimertVarighetDager !== null ? task.EstimertVarighetDager : ''; // Reset to old value
    }
}

/**
 * Handles sending a simulated message.
 */
function handleSendMessage() {
     const recipientId = messageRecipientEl.value;
     const subject = messageSubjectEl.value.trim();
     const body = messageBodyEl.value.trim();

      if (!currentUser) {
         alert("Kan ikke sende melding, ingen bruker er valgt.");
         return;
      }


     if (!recipientId || !body) {
         alert('Vennligst velg mottaker og skriv en melding.');
         return;
     }

     addNotification('message', body, currentUser.BrukerID, null, recipientId, subject);
     newMessageModal.style.display = 'none'; // Hide modal
     renderMessages(); // Update message list
     renderNotificationsList(latestNotificationsListEl, 5); // Update dashboard list
}

// === 5.4: EVENT HANDLERS END ===


// === 5.5: TASK ACTIONS & LOGIC START ===

/**
 * Updates the status of a task and handles related side effects.
 * @param {string} taskId - The ID of the task to update.
 * @param {string} newStatus - The new status string.
 * @param {object} [options={}] - Additional options (e.g., { godkjent: true }).
 */
function updateTaskStatus(taskId, newStatus, options = {}) {
    const task = findTaskById(taskId);
    if (!task) return;

    const oldStatus = task.Status;
    // Allow re-completing only if it was rejected or problem resolved back to Pågår
    if (oldStatus === newStatus && newStatus !== 'Utført') return;

    console.log(`Updating status for task ${taskId}: ${oldStatus} -> ${newStatus}`);
    task.Status = newStatus;

    // Update timestamps
    if (newStatus === 'Pågår' && !task.FaktiskStartDato) {
        task.FaktiskStartDato = new Date();
    }
    // Always reset approval and problem when setting to Pågår (e.g., after rejection or problem resolve)
     if (newStatus === 'Pågår') {
        task.GodkjentAvLeder = false;
        task.ProblemBeskrivelse = null;
     }

    if (newStatus === 'Venter på Godkjenning') {
         task.GodkjentAvLeder = false; // Ensure it's false, waiting for leader
         task.ProblemBeskrivelse = null; // Clear problem when completing
    } else if (newStatus === 'Utført') {
        task.FaktiskSluttDato = new Date();
        task.GodkjentAvLeder = options.godkjent || task.GodkjentAvLeder; // Set approval flag
        task.ProblemBeskrivelse = null; // Clear problem when completed
        // --- Crucial: Check and update successors ---
        triggerSuccessorUpdate(taskId);
    } else if (newStatus === 'Problem Rapportert') {
        // Keep FaktiskStartDato if it exists
    }

    // Recalculate dates if status change affects timing (e.g., completion)
    recalculateTaskDates(task);

    // Add notification
    addNotification('system', `Status for Oppgave ${task.OppgaveNr} (${task.OppgaveNavn}) endret til '${newStatus}' av ${currentUser.Navn}.`, currentUser.BrukerID, taskId);


    // Re-render the application to reflect changes
    renderApp();

    // If the detail view for this task is currently open, refresh it
    if (taskDetailViewEl.classList.contains('active-view')) {
        const detailTaskId = taskDetailViewEl.querySelector('.save-duration-button')?.dataset.taskId;
        if (detailTaskId === taskId) {
            showTaskDetail(taskId);
        }
    }
}

/**
 * Checks prerequisites for dependent tasks and updates their status if they can now start.
 * @param {string} completedTaskId - The ID of the task that was just completed.
 */
function triggerSuccessorUpdate(completedTaskId) {
    console.log(`Task ${completedTaskId} completed, checking successors...`);
    tasks.forEach(task => {
        if (task.ForutsetningerIDs?.includes(completedTaskId)) {
            // This task depends on the one just completed
            if (task.Status === 'Ikke startet' || task.Status === 'Venter på forutsetning') {
                if (arePrerequisitesMet(task)) {
                    console.log(`All prerequisites met for task ${task.OppgaveID}. Updating status.`);
                    // Only update status, don't automatically start it
                    task.Status = 'Ikke startet';
                    task.BeregnetStartDato = calculateEarliestStartDate(task); // Update calculated start
                     addNotification('system', `Forutsetninger for Oppgave ${task.OppgaveNr} (${task.OppgaveNavn}) er nå møtt. Arbeidet kan startes.`, null, task.OppgaveID);
                      // Recalculate dates for this task as its start date might have changed
                     recalculateTaskDates(task);
                } else {
                    task.Status = 'Venter på forutsetning'; // Ensure it's waiting if not all are met
                     console.log(`Prerequisites still not met for task ${task.OppgaveID}.`);
                }
            }
        }
    });
}


/**
 * Checks if all prerequisites for a given task are met (status is 'Utført').
 * @param {object} task - The task object to check.
 * @returns {boolean} True if all prerequisites are met, false otherwise.
 */
function arePrerequisitesMet(task) {
    if (!task.ForutsetningerIDs || task.ForutsetningerIDs.length === 0) {
        return true; // No prerequisites
    }
    return task.ForutsetningerIDs.every(preReqId => {
        const preReqTask = findTaskById(preReqId);
        // A prerequisite is met if the task exists and its status is 'Utført'
        return preReqTask && preReqTask.Status === 'Utført';
    });
}

/**
 * Placeholder for recalculating task dates.
 * In PoC, this is simplified: only updates end date based on duration.
 * A full implementation would involve critical path analysis.
 * @param {object} task - The task whose dates might need recalculation.
 */
function recalculateTaskDates(task) {
    // Simplified: Calculate end date based on start and duration
    let startDate = task.FaktiskStartDato || task.BeregnetStartDato;

    if (!startDate) {
         startDate = calculateEarliestStartDate(task);
         task.BeregnetStartDato = startDate;
    }


    if (startDate && task.EstimertVarighetDager !== null) { // Check for null duration explicitly
        task.BeregnetSluttDato = addWorkDays(startDate, task.EstimertVarighetDager);
         console.log(`Recalculated end date for ${task.OppgaveID} to ${formatDate(task.BeregnetSluttDato)}`);
    } else {
         task.BeregnetSluttDato = null; // Clear end date if duration or start is missing
    }


    // --- Propagate changes (Very Simplified PoC) ---
    const successorTasks = tasks.filter(t => t.ForutsetningerIDs?.includes(task.OppgaveID));
    successorTasks.forEach(succTask => {
         const newStartDate = calculateEarliestStartDate(succTask);
         // Only update if the new calculated start is later than the existing one,
         // or if the existing one wasn't set. Prevent pulling dates earlier unnecessarily.
         if (newStartDate && (!succTask.BeregnetStartDato || newStartDate > succTask.BeregnetStartDato)) {
             succTask.BeregnetStartDato = newStartDate;
             console.log(`Propagating date change to successor ${succTask.OppgaveID}, new start: ${formatDate(newStartDate)}`);
             // Recursively recalculate this successor
             recalculateTaskDates(succTask); // Be mindful of potential infinite loops if circular dependencies exist (should not in this model)
         } else if (!newStartDate && succTask.BeregnetStartDato) {
             // If we can no longer calculate a start date (e.g., prerequisite date removed), clear it?
             // succTask.BeregnetStartDato = null;
             // recalculateTaskDates(succTask); // Propagate the uncertainty
         }
    });
}


/**
 * Calculates the earliest possible start date for a task based on its prerequisites' completion dates.
 * @param {object} task - The task object.
 * @returns {Date | null} The calculated earliest start date, or null.
 */
 function calculateEarliestStartDate(task) {
    if (!task.ForutsetningerIDs || task.ForutsetningerIDs.length === 0) {
        // If no prerequisites, use project start date if available
        return projectData?.project?.StartDato ? new Date(projectData.project.StartDato) : new Date(); // Fallback to today
    }

    let latestPrerequisiteEndDate = null;
    let prerequisitesComplete = true; // Assume complete initially

    for (const preReqId of task.ForutsetningerIDs) {
        const preReqTask = findTaskById(preReqId);
        if (preReqTask) {
            // Use actual end date if available and task is 'Utført', otherwise use calculated end date
            const endDate = preReqTask.Status === 'Utført'
                           ? (preReqTask.FaktiskSluttDato || preReqTask.BeregnetSluttDato)
                           : preReqTask.BeregnetSluttDato;

            if (preReqTask.Status !== 'Utført') {
                prerequisitesComplete = false; // Mark as not ready if any prerequisite is not 'Utført'
            }


            if (endDate) {
                if (!latestPrerequisiteEndDate || endDate > latestPrerequisiteEndDate) {
                    latestPrerequisiteEndDate = endDate;
                }
            } else {
                // If a prerequisite has no end date, we can't calculate accurately.
                return null; // Cannot determine start date if any prerequisite end date is unknown
            }
        } else {
            console.warn(`Prerequisite task ${preReqId} not found for task ${task.OppgaveID}`);
            return null; // Cannot determine start date if prerequisite task is missing
        }
    }


     // Only return a date if all prerequisites are actually marked 'Utført'
    if (latestPrerequisiteEndDate && prerequisitesComplete) {
        const nextDay = new Date(latestPrerequisiteEndDate);
        nextDay.setDate(nextDay.getDate() + 1); // Simple +1 day. Could be smarter about workdays.
        // Ensure the calculated start date is not in the past relative to today? Optional.
        // const today = new Date(); today.setHours(0,0,0,0);
        // return nextDay < today ? today : nextDay;
        return nextDay;
    }


    return null; // Cannot determine start date if prerequisites aren't complete or dates missing
}


/**
 * Simulates reporting a problem for a task.
 * @param {string} taskId - The ID of the task.
 */
function reportProblem(taskId) {
    const task = findTaskById(taskId);
     if (!task || task.Status === 'Utført' || !currentUser) return;


    const reason = prompt(`Beskriv problemet for oppgave ${task.OppgaveNr} (${task.OppgaveNavn}):`, task.ProblemBeskrivelse || '');
    if (reason !== null) { // Handle cancel button
        task.ProblemBeskrivelse = reason.trim() || "Problem rapportert uten beskrivelse"; // Store reason
        updateTaskStatus(taskId, 'Problem Rapportert');
         addNotification('system', `Problem rapportert for Oppgave ${task.OppgaveNr} av ${currentUser.Navn}: "${task.ProblemBeskrivelse}"`, currentUser.BrukerID, taskId);
    }
}

/**
 * Simulates resolving a problem for a task (Project Leader action).
 * @param {string} taskId - The ID of the task.
 */
function resolveProblem(taskId) {
    const task = findTaskById(taskId);
     if (!task || task.Status !== 'Problem Rapportert' || !currentUser) return;


    // Determine previous state or a sensible state to return to
    let statusBeforeProblem = 'Pågår'; // Default to ongoing
    if (task.FaktiskStartDato === null) {
         if (arePrerequisitesMet(task)) {
             statusBeforeProblem = 'Ikke startet';
         } else {
            statusBeforeProblem = 'Venter på forutsetning';
         }
    }


    task.ProblemBeskrivelse = null; // Clear the problem description
    updateTaskStatus(taskId, statusBeforeProblem);
    addNotification('system', `Problem for Oppgave ${task.OppgaveNr} markert som løst av ${currentUser.Navn}. Status satt til '${statusBeforeProblem}'.`, currentUser.BrukerID, taskId);
}

/**
 * Admin action to mark a task as fully complete, bypassing normal workflow.
 * @param {string} taskId - The ID of the task.
 */
 function adminMarkTaskComplete(taskId) {
    const task = findTaskById(taskId);
     if (!task || !currentUser || !currentUser.RolleIDs.includes('ROLLE-PL')) return;


    console.log(`Admin marking task ${taskId} as complete.`);
    const oldStatus = task.Status;

    // Set necessary fields as if it went through the process
    if (!task.FaktiskStartDato) task.FaktiskStartDato = new Date(); // Assume it started now if not started
    task.FaktiskSluttDato = new Date();
    task.Status = 'Utført';
    task.GodkjentAvLeder = true;
    task.ProblemBeskrivelse = null;

    addNotification('system', `Oppgave ${task.OppgaveNr} hurtigfullført av Admin (${currentUser.Navn}).`, currentUser.BrukerID, taskId);

    // Trigger updates for successors
    triggerSuccessorUpdate(taskId);

    // Recalculate dates
    recalculateTaskDates(task);

    // Re-render
    renderApp();
     // If the detail view for this task is currently open, refresh it
    if (taskDetailViewEl.classList.contains('active-view')) {
        const detailTaskId = taskDetailViewEl.querySelector('.save-duration-button')?.dataset.taskId;
        if (detailTaskId === taskId) {
            showTaskDetail(taskId);
        }
    }
}


/**
 * Determines if the current user can edit the duration of a task.
 * @param {object} task - The task object.
 * @returns {boolean}
 */
function canEditDuration(task) {
     // Add null check for currentUser
    if (!currentUser) return false;

    // Allow editing if the user is responsible OR is the project leader,
    // AND the task is not yet completed.
    const isProjectLeader = currentUser.RolleIDs.includes('ROLLE-PL');
    const isResponsibleUser = currentUser.RolleIDs.includes(task.AnsvarligRolleID);
    return (isProjectLeader || isResponsibleUser) && task.Status !== 'Utført';
}


// === 5.5: TASK ACTIONS & LOGIC END ===


// === 5.6: UTILITY FUNCTIONS START ===

/**
 * Finds a task object by its ID.
 * @param {string} taskId - The ID of the task.
 * @returns {object | undefined} The task object or undefined if not found.
 */
function findTaskById(taskId) {
     if (!tasks) return undefined; // Guard against tasks not being loaded yet
    return tasks.find(task => task.OppgaveID === taskId);
}

/**
 * Finds a user object by its ID.
 * @param {string} userId - The ID of the user.
 * @returns {object | undefined} The user object or undefined if not found.
 */
function findUserById(userId) {
    if (!users) return undefined;
    return users.find(user => user.BrukerID === userId);
}

/**
 * Finds a role object by its ID.
 * @param {string} roleId - The ID of the role.
 * @returns {object | undefined} The role object or undefined if not found.
 */
function getRoleById(roleId) {
    if (!roles) return undefined;
    return roles.find(role => role.RolleID === roleId);
}

/**
 * Finds all users associated with a given role ID.
 * @param {string} roleId - The ID of the role.
 * @returns {Array<object>} An array of user objects.
 */
function findUsersByRole(roleId) {
    if (!users) return [];
    return users.filter(user => user.RolleIDs.includes(roleId));
}


/**
 * Gets all role objects associated with a given user.
 * @param {object} user - The user object.
 * @returns {Array<object>} An array of role objects.
 */
 function getRolesForUser(user) {
     if (!user || !user.RolleIDs || !roles) return [];
     return user.RolleIDs.map(roleId => getRoleById(roleId)).filter(role => role); // Find roles based on IDs and filter out nulls
 }


/**
 * Formats a Date object into a readable string (DD.MM.YYYY).
 * Includes time if includeTime is true.
 * @param {Date | null} date - The date object to format.
 * @param {boolean} includeTime - Whether to include HH:MM.
 * @returns {string} Formatted date string or 'N/A'.
 */
function formatDate(date, includeTime = false) {
    if (!date || !(date instanceof Date) || isNaN(date)) {
        return 'N/A';
    }
    try {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
        const year = date.getFullYear();
        let formatted = `${day}.${month}.${year}`;

        if (includeTime) {
             const hours = String(date.getHours()).padStart(2, '0');
             const minutes = String(date.getMinutes()).padStart(2, '0');
             formatted += ` ${hours}:${minutes}`;
        }
        return formatted;
     } catch (e) {
        console.error("Error formatting date:", date, e);
        return 'Feil dato';
    }
}

/**
 * Adds a number of work days (Mon-Fri) to a date. Very basic implementation.
 * @param {Date} startDate - The starting date.
 * @param {number} days - The number of work days to add.
 * @returns {Date} The resulting date.
 */
function addWorkDays(startDate, days) {
    if (!startDate || !(startDate instanceof Date) || isNaN(startDate) || days === null || isNaN(days) || days < 0) {
         console.warn("Invalid input to addWorkDays:", startDate, days);
         // Decide on fallback: return original date, null, or throw error?
         return null; // Returning null might be safer than returning original date
    }
    let currentDate = new Date(startDate);
    let addedDays = 0;
    let safetyCounter = 0; // Prevent infinite loops with bad input/logic
    while (addedDays < days && safetyCounter < (days * 3 + 10)) { // Generous safety limit
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            addedDays++;
        }
        safetyCounter++;
    }
     if (safetyCounter >= (days * 3 + 10)) {
        console.error("addWorkDays safety counter triggered for:", startDate, days);
        return null; // Return null if loop seems infinite
    }
    return currentDate;
}


/**
 * Calculates the overall project progress percentage (simple version).
 * @returns {number} Progress percentage (0-100).
 */
function calculateProjectProgress() {
    if (!tasks || tasks.length === 0) return 0;
    const completedTasks = tasks.filter(task => task.Status === 'Utført').length;
    return Math.round((completedTasks / tasks.length) * 100);
}

/**
 * Calculates a rough project Estimated Time of Arrival (ETA).
 * Finds the latest 'BeregnetSluttDato' among all tasks.
 * @returns {string} Formatted ETA date string or 'Ukjent'.
 */
function calculateProjectEta() {
     if (!tasks || tasks.length === 0) return 'Ukjent'; // Handle no tasks case

    let latestEndDate = null;
    tasks.forEach(task => {
        // Consider both calculated and actual end dates if actual is later?
        // For ETA based on plan, BeregnetSluttDato is usually preferred.
        const endDate = task.BeregnetSluttDato;
        if (endDate && endDate instanceof Date && !isNaN(endDate)) { // Check if valid Date
            if (!latestEndDate || endDate > latestEndDate) {
                latestEndDate = endDate;
            }
        }
    });
    return latestEndDate ? formatDate(latestEndDate) : 'Ukjent';
}

/**
 * Adds a notification/message to the global list.
 * @param {'system' | 'message'} type - The type of notification.
 * @param {string} body - The message content.
 * @param {string | null} senderId - BrukerID of the sender (null for system).
 * @param {string | null} taskId - OppgaveID if related to a task.
 * @param {string | null} recipientId - BrukerID of the recipient (for messages).
 * @param {string | null} subject - Subject line (for messages).
 */
function addNotification(type, body, senderId = null, taskId = null, recipientId = null, subject = null) {
    const notification = {
        id: `notif-${Date.now()}-${Math.random()}`, // Simple unique ID
        type: type, // 'system' or 'message'
        body: body,
        senderId: senderId,
        recipientId: recipientId, // Only for messages
        subject: subject,       // Only for messages
        taskId: taskId,         // Link to task if relevant
        timestamp: new Date(),
        read: false // Not really used in PoC display
    };
    notifications.push(notification);
    console.log("Notification added:", notification);

    // Update notification displays immediately if the relevant lists exist
    if (latestNotificationsListEl) {
         renderNotificationsList(latestNotificationsListEl, 5); // Update dashboard list
    }
     if (messageListContainerEl && currentView === 'messages') {
         renderMessages(); // Update full message list if active
     }
}


// === 5.6: UTILITY FUNCTIONS END ===


// === 5.7: VIEW MANAGEMENT START ===

/**
 * Switches the active view displayed in the main content area.
 * @param {string} viewId - The ID of the view div to activate.
 */
function switchView(viewId) {
    console.log("Switching view to:", viewId);
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active-view');
    });
    // Show the target view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active-view');
        currentView = viewId; // Update global state
    } else {
        console.error(`View with ID ${viewId} not found! Falling back to dashboard.`);
        // Fallback to dashboard
        const dashboardView = document.getElementById('dashboard');
        if (dashboardView) {
            dashboardView.classList.add('active-view');
            currentView = 'dashboard';
        } else {
             // Absolute fallback if even dashboard is missing
             appContent.innerHTML = `<p style="color: red; padding: 20px;">FEIL: Finner ingen visninger!</p>`;
        }

    }
}

/**
 * Updates the visual style of the active navigation button.
 */
function updateActiveNavButton() {
    navButtons.forEach(button => {
        if (button.dataset.targetView === currentView) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// === 5.7: VIEW MANAGEMENT END ===


// === 5.8: APPLICATION STARTUP ===
// Add event listener to run init when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', init);
// === 5.8: APPLICATION STARTUP END ===


// === 5: MAIN APPLICATION SCRIPT END ===
