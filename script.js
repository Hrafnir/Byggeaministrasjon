// === 5: MAIN APPLICATION SCRIPT START ===

// === 5.1: GLOBAL VARIABLES & STATE START ===
let projectData = null; // Holds data for THE specific project ("Kontorbygg Sentrum")
let userData = null;    // Holds all user and role definitions
let tasks = [];         // Array of task objects FOR THE CURRENT PROJECT
let users = [];         // Array of user objects with their projects/priorities
let roles = [];         // Array of role objects
let currentUser = null; // The currently selected user object
let currentView = 'dashboard'; // The currently active view ID
let notifications = []; // Simple array to simulate notifications

// DOM Element References
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
// New reference for project list view
const userProjectListContainerEl = document.getElementById('userProjectListContainer');
// === 5.1: GLOBAL VARIABLES & STATE END ===


// === 5.2: INITIALIZATION FUNCTIONS START ===
/**
 * Helper function to remove single-line comments (//) from a JSON string.
 */
function removeJsonComments(jsonString) { /* ... (uendret) ... */
    return jsonString.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
 }

/**
 * Fetches data from JSON files, handling potential comments.
 */
async function loadData() { /* ... (uendret - bruker fortsatt removeJsonComments) ... */
    try {
        const [projectResponse, userResponse] = await Promise.all([
            fetch('project_data.json'),
            fetch('users_roles.json')
        ]);
        if (!projectResponse.ok || !userResponse.ok) { let errorMsg = 'Kunne ikke laste data. '; if (!projectResponse.ok) errorMsg += `Prosjektfil (Status: ${projectResponse.status}). `; if (!userResponse.ok) errorMsg += `Brukerfil (Status: ${userResponse.status}).`; throw new Error(errorMsg); }
        const projectText = await projectResponse.text(); const userText = await userResponse.text();
        projectData = JSON.parse(removeJsonComments(projectText)); userData = JSON.parse(removeJsonComments(userText));
        console.log("Data loaded successfully:", { projectData, userData });
        processLoadedData();
    } catch (error) { console.error('Error loading/parsing data:', error); let displayError = 'Kunne ikke laste data. '; if (error instanceof SyntaxError) displayError += 'JSON formatfeil.'; else displayError += ` (${error.message}).`; appContent.innerHTML = `<p style="color: red; padding: 20px;">${displayError}</p>`; userSelect.innerHTML = '<option value="">Feil</option>'; }
}


/**
 * Processes the raw data loaded from JSON into usable arrays and objects.
 */
function processLoadedData() {
    if (!projectData || !userData) return;

    // Process tasks for the single loaded project
    tasks = projectData.tasks.map(task => ({
        ...task,
        ForutsetningerIDs: task.Forutsetninger.map(nr => `TASK-${String(nr).padStart(3, '0')}`),
        BeregnetStartDato: null, // Initial calculation will set these
        BeregnetSluttDato: null,
        FaktiskStartDato: null,
        FaktiskSluttDato: null,
        EstimertVarighetDager: typeof task.EstimertVarighetDager === 'number' ? task.EstimertVarighetDager : null,
        GodkjentAvLeder: false,
        ProblemBeskrivelse: null,
        JustMadeReady: false
    }));

    roles = userData.roles;
    // Users now include their project involvement directly from JSON
    users = userData.users;

    // Ensure users have a projects array if it's missing in the JSON
    users.forEach(user => {
        if (!user.projects) {
            user.projects = [];
             // If the user has roles in the main project, add it to their list
             if (projectData && user.RolleIDs.some(roleId => tasks.some(task => task.AnsvarligRolleID === roleId))) {
                user.projects.push({
                    projectId: projectData.project.ProsjektID,
                    projectName: projectData.project.ProsjektNavn,
                    userPriority: 1, // Default priority
                    availability: "Ikke satt"
                });
             }
        }
         // Ensure default priority and availability if missing on existing project entries
         user.projects.forEach(proj => {
            if (proj.userPriority === undefined) proj.userPriority = 99; // Default low priority
            if (proj.availability === undefined) proj.availability = "Ikke satt";
        });
    });


    const projectLeader = users.find(u => u.RolleIDs.includes('ROLLE-PL')) || users[0];
    if (projectLeader) currentUser = projectLeader;
    else if (users.length > 0) currentUser = users[0];
    else console.error("Ingen brukere funnet!");

    populateUserSelector();
    populatePhaseFilter();
    populateMessageRecipientSelector();
    calculateInitialDates(); // Perform initial date calc for the loaded project
}

/**
 * Populates the global user selector dropdown.
 */
function populateUserSelector() { /* ... (uendret) ... */
    if (!users || users.length === 0) { userSelect.innerHTML = '<option value="">Ingen</option>'; return; } userSelect.innerHTML = ''; users.forEach(user => { const option = document.createElement('option'); option.value = user.BrukerID; option.textContent = `${user.Navn} (${getRolesForUser(user).map(r => r.RolleNavn).join(', ')})`; userSelect.appendChild(option); }); if (currentUser) userSelect.value = currentUser.BrukerID;
}

/**
 * Populates the phase filter dropdown.
 */
function populatePhaseFilter() { /* ... (uendret) ... */
    if (!tasks || !phaseFilterEl) return; const phases = [...new Set(tasks.map(t => t.Fase))]; phaseFilterEl.innerHTML = '<option value="all">Alle Faser</option>'; phases.sort(); phases.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p; phaseFilterEl.appendChild(o); });
}

/**
 * Populates the recipient selector in the new message modal.
 */
 function populateMessageRecipientSelector() { /* ... (uendret) ... */
    if (!users || !messageRecipientEl) return; messageRecipientEl.innerHTML = ''; users.forEach(u => { const o = document.createElement('option'); o.value = u.BrukerID; o.textContent = u.Navn; messageRecipientEl.appendChild(o); });
}

/**
 * Performs initial calculation of all task dates for the loaded project.
 */
 function calculateInitialDates() { /* ... (uendret) ... */
    console.log("Calculating initial dates..."); tasks.forEach(t => t.BeregnetStartDato = calculateEarliestStartDate(t)); tasks.forEach(t => { if (t.BeregnetStartDato && t.EstimertVarighetDager !== null) t.BeregnetSluttDato = addWorkDays(t.BeregnetStartDato, t.EstimertVarighetDager); else t.BeregnetSluttDato = null; }); console.log("Initial dates done.");
}

/**
 * Main initialization function called on page load.
 */
async function init() { /* ... (uendret) ... */
    console.log("Initializing..."); setupEventListeners(); setupDashboardCards(); await loadData(); if (projectData && userData) renderApp(); else console.log("Init halted: data load fail.");
}

/**
 * Dynamically adds the 'Pending Actions' card structure to the dashboard grid.
 */
function setupDashboardCards() { /* ... (uendret) ... */
    const grid = document.querySelector('#dashboard .dashboard-grid'); if (!grid) return; if (!document.getElementById('pendingActionsCard')) { const card = document.createElement('div'); card.className = 'card card-pending-actions'; card.id = 'pendingActionsCard'; card.innerHTML = `<h3>Handlinger Kreves <span class="action-count"></span></h3><ul id="pendingActionsList"><li>Laster...</li></ul>`; const activeCard = document.getElementById('activeTasksCard'); if (activeCard) grid.insertBefore(card, activeCard.nextSibling); else grid.appendChild(card); }
}

// === 5.2: INITIALIZATION FUNCTIONS END ===


// === 5.3: RENDERING FUNCTIONS START ===

/**
 * Main render function to update the entire UI based on current state.
 */
function renderApp() {
    if (!projectData || !userData || !currentUser) { /* ... (error handling uendret) ... */
        console.log("Render blocked."); if (!document.querySelector('#appContent p[style*="color: red;"]')) appContent.innerHTML = '<p style="color:orange;">Kan ikke vise data...</p>'; return;
    }
    const errEl = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]'); if (errEl) errEl.remove();

    console.log(`Rendering app for user: ${currentUser.Navn}, view: ${currentView}`);

    renderDashboard(); // Renders dashboard for the *loaded* project
    renderProjectList(); // Renders the user's list of *all* involved projects
    renderFullTaskList(); // Renders tasks for the *loaded* project
    renderMyTasksList(); // Renders user's tasks for the *loaded* project
    renderUserList(); // Renders users involved in the *loaded* project
    renderDependenciesView(); // Renders dependencies for the *loaded* project
    renderMessages();

    switchView(currentView);
    updateActiveNavButton();
}

/**
 * Renders the dashboard view for the currently loaded project.
 */
function renderDashboard() { /* ... (uendret - viser kun info for 'Kontorbygg Sentrum') ... */
    if (!projectData || !tasks) return; projectStatusEl.textContent = projectData.project.Status; projectEtaEl.textContent = calculateProjectEta(); const progress = calculateProjectProgress(); progressBarEl.style.width = `${progress}%`; progressPercentageEl.textContent = progress; const activeTasks = tasks.filter(t => t.Status === 'Pågår'); activeTasksListEl.innerHTML = ''; if (!activeTasks.length) activeTasksListEl.innerHTML = '<li>Ingen aktive oppgaver</li>'; else { activeTasks.slice(0, 5).forEach(t => { const li = document.createElement('li'); const role = getRoleById(t.AnsvarligRolleID); li.innerHTML = `<strong style="cursor:pointer;">${t.OppgaveNr}. ${t.OppgaveNavn}</strong> (${role?.RolleNavn || '?'})`; li.querySelector('strong').onclick = () => showTaskDetail(t.OppgaveID); activeTasksListEl.appendChild(li); }); } renderPendingActions(); renderNotificationsList(latestNotificationsListEl, 5);
}

/**
 * Renders the "Pending Actions" card on the dashboard (for the loaded project).
 */
 function renderPendingActions() { /* ... (uendret - henter actions for currentUser i det lastede prosjektet) ... */
    const listEl = document.getElementById('pendingActionsList'); const countEl = document.querySelector('#pendingActionsCard .action-count'); const cardEl = document.getElementById('pendingActionsCard'); if (!listEl || !countEl || !cardEl) { console.error("Missing elements for pending actions."); return; } const actions = getPendingActionsForUser(currentUser); listEl.innerHTML = ''; if (actions.length === 0) { listEl.innerHTML = '<li>Ingen handlinger kreves.</li>'; countEl.textContent = ''; cardEl.classList.remove('has-actions'); } else { countEl.textContent = `(${actions.length})`; cardEl.classList.add('has-actions'); actions.slice(0, 5).forEach((action, i) => { const li = document.createElement('li'); li.style.cursor = 'pointer'; li.onclick = () => showTaskDetail(action.task.OppgaveID); let prefix = '', itemClass = '', hlStyle = ''; switch (action.type) { case 'Løs Problem': prefix = `<span class="action-icon problem">❗</span> Problem:`; itemClass = 'action-problem'; break; case 'Godkjenn Oppgave': prefix = `<span class="action-icon approval">⚠️</span> Godkjenning:`; itemClass = 'action-approval'; break; case 'Start Oppgave': prefix = `<span class="action-icon start">✅</span> Klar til start:`; itemClass = 'action-start'; if (action.task.JustMadeReady) hlStyle = 'background-color: var(--status-waiting); animation: blinkBackground 1.5s ease-in-out 2;'; break; default: prefix = 'Handling:'; } li.style.cssText = hlStyle; li.className = itemClass; if (i === 0) { li.classList.add('highest-priority-action'); prefix = `<strong>${prefix}</strong>`; } li.innerHTML = `${prefix} ${action.task.OppgaveNr}. ${action.task.OppgaveNavn}`; listEl.appendChild(li); if (action.type === 'Start Oppgave' && action.task.JustMadeReady) action.task.JustMadeReady = false; }); }
}

/**
 * NEW: Renders the list of projects the user is involved in.
 */
function renderProjectList() {
    if (!currentUser || !userProjectListContainerEl) return;

    userProjectListContainerEl.innerHTML = ''; // Clear previous list

    if (!currentUser.projects || currentUser.projects.length === 0) {
        userProjectListContainerEl.innerHTML = '<p>Du er ikke lagt til i noen prosjekter ennå.</p>';
        return;
    }

     // Sort projects by userPriority
     const sortedProjects = [...currentUser.projects].sort((a, b) => (a.userPriority || 99) - (b.userPriority || 99));


    const table = document.createElement('table');
    table.className = 'project-list-table'; // Add class for styling
    table.innerHTML = `
        <thead>
            <tr>
                <th>Prosjektnavn</th>
                <th>Min Prioritet (1=høyest)</th>
                <th>Min Tilgjengelighet</th>
                <th>Handlinger</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    sortedProjects.forEach(proj => {
        const tr = document.createElement('tr');
        tr.dataset.projectId = proj.projectId; // Store project ID for reference

         // Check if this is the currently loaded project
         const isCurrentProject = proj.projectId === projectData?.project?.ProsjektID;

        tr.innerHTML = `
            <td>${proj.projectName} ${isCurrentProject ? '(Dette prosjektet)' : ''}</td>
            <td><input type="number" class="priority-input" value="${proj.userPriority || ''}" min="1" style="width: 50px;"></td>
            <td><input type="text" class="availability-input" value="${proj.availability || ''}" placeholder="f.eks. Fulltid, Man-Fre, Uke 35..."></td>
            <td><button class="save-project-settings-button">Lagre</button></td>
        `;
        tbody.appendChild(tr);
    });

    userProjectListContainerEl.appendChild(table);

     // Add event listeners for the save buttons using delegation
     userProjectListContainerEl.removeEventListener('click', handleProjectListClicks); // Remove old listener first
     userProjectListContainerEl.addEventListener('click', handleProjectListClicks);
}


/**
 * Renders the full task list FOR THE LOADED PROJECT.
 */
function renderFullTaskList() { /* ... (uendret) ... */
    if (!tasks) return; const pF = phaseFilterEl.value; const sF = statusFilterEl.value; const fT = tasks.filter(t => (pF === 'all' || t.Fase === pF) && (sF === 'all' || t.Status === sF)); fullTaskListContainerEl.innerHTML = ''; if (!fT.length) { fullTaskListContainerEl.innerHTML = '<p>Ingen oppgaver.</p>'; return; } fT.sort((a,b) => a.OppgaveNr - b.OppgaveNr); const isPL = currentUser?.RolleIDs.includes('ROLLE-PL'); fT.forEach(t => fullTaskListContainerEl.appendChild(createTaskElement(t, true, isPL)));
}

/**
 * Renders the "My Tasks" list FOR THE LOADED PROJECT.
 */
function renderMyTasksList() { /* ... (uendret) ... */
    if (!currentUser || !tasks) { myTasksListContainerEl.innerHTML = '<p>Velg bruker.</p>'; return; } const isPL = currentUser.RolleIDs.includes('ROLLE-PL'); const myT = tasks.filter(t => currentUser.RolleIDs.includes(t.AnsvarligRolleID) || (isPL && t.Status === 'Venter på Godkjenning')); myTasksListContainerEl.innerHTML = ''; if (!myT.length) { myTasksListContainerEl.innerHTML = '<p>Ingen relevante oppgaver.</p>'; return; } myT.sort((a,b) => { const o = {"Problem Rapportert":1, "Venter på Godkjenning":2, "Pågår":3, "Ikke startet":4, "Venter på forutsetning":5, "Utført":6}; const sa = (isPL && a.Status === 'Venter på Godkjenning') ? a.Status : a.Status; const sb = (isPL && b.Status === 'Venter på Godkjenning') ? b.Status : b.Status; const oa = o[sa] || 99; const ob = o[sb] || 99; if (oa !== ob) return oa - ob; const da = a.BeregnetStartDato || new Date('9999-12-31'); const db = b.BeregnetStartDato || new Date('9999-12-31'); const daV = da instanceof Date && !isNaN(da); const dbV = db instanceof Date && !isNaN(db); if (daV && dbV) { if (da.getTime() !== db.getTime()) return da - db; } else if (daV) return -1; else if (dbV) return 1; return a.OppgaveNr - b.OppgaveNr; }); myT.forEach(t => myTasksListContainerEl.appendChild(createTaskElement(t, false, isPL)));
}

/**
 * Creates an HTML element representing a single task item FOR THE LOADED PROJECT.
 */
function createTaskElement(task, isAdminView, isViewerProjectLeader = false) { /* ... (uendret) ... */
    const el = document.createElement('div'); el.className = 'task-item'; el.dataset.taskId = task.OppgaveID; el.dataset.status = task.Status; const role = getRoleById(task.AnsvarligRolleID); const dur = task.EstimertVarighetDager !== null ? `${task.EstimertVarighetDager} dager` : 'Ikke est.'; const appCue = (isViewerProjectLeader && task.Status === 'Venter på Godkjenning') ? `<strong class="cue cue-approval">⚠️ Til Godkjenning</strong>` : ''; const probCue = (task.Status === 'Problem Rapportert') ? `<strong class="cue cue-problem">❗ Problem (${task.ProblemBeskrivelse || 'rapp.'})</strong>` : ''; const readyCue = (task.Status === 'Ikke startet' && arePrerequisitesMet(task) && currentUser?.RolleIDs.includes(task.AnsvarligRolleID)) ? `<strong class="cue cue-ready">✅ Klar!</strong>` : ''; el.innerHTML = `<h4>${task.OppgaveNr}. ${task.OppgaveNavn} ${appCue} ${readyCue}</h4><div class="task-meta">Ansvarlig: ${role?.RolleNavn || '?'} | Status: ${task.Status}${probCue} | Start: ${formatDate(task.BeregnetStartDato)} | Slutt: ${formatDate(task.BeregnetSluttDato)}</div><div class="task-duration">${dur}</div><div class="task-actions"><button class="details-button">Detaljer</button>${isAdminView && isViewerProjectLeader && task.Status !== 'Utført' ? '<button class="admin-complete-button" title="Admin: Hurtigfullfør">⚡ Fullfør</button>' : ''}</div>`; el.querySelector('.details-button').onclick = (e) => { e.stopPropagation(); showTaskDetail(task.OppgaveID); }; const adminBtn = el.querySelector('.admin-complete-button'); if (adminBtn) adminBtn.onclick = (e) => { e.stopPropagation(); adminMarkTaskComplete(task.OppgaveID); }; if (task.JustMadeReady && task.Status === 'Ikke startet') el.style.animation = 'blinkBackground 1.5s ease-in-out 2'; else el.style.animation = 'none'; return el;
}

/**
 * Renders the task detail view FOR THE LOADED PROJECT.
 */
function showTaskDetail(taskId) { /* ... (uendret) ... */
     const task = findTaskById(taskId); if (!task) return; const errEl = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]'); if (errEl) errEl.remove(); currentView = 'taskDetail'; taskDetailViewEl.classList.add('active-view'); document.querySelectorAll('.view:not(#taskDetail)').forEach(v => v.classList.remove('active-view')); const role = getRoleById(task.AnsvarligRolleID); const respUsers = findUsersByRole(task.AnsvarligRolleID); let preHtml = 'Ingen'; if (task.ForutsetningerIDs?.length > 0) { preHtml = '<ul>' + task.ForutsetningerIDs.map(id => { const pt = findTaskById(id); return pt ? `<li>${pt.Status === 'Utført' ? '✅' : '⚪'} ${pt.OppgaveNr}. ${pt.OppgaveNavn} (${pt.Status})</li>` : `<li>? ID: ${id}</li>`; }).join('') + '</ul>'; } let succHtml = 'Ingen'; const succTasks = tasks.filter(t => t.ForutsetningerIDs?.includes(task.OppgaveID)); if (succTasks.length > 0) succHtml = '<ul>' + succTasks.map(st => `<li>${st.OppgaveNr}. ${st.OppgaveNavn} (${st.Status})</li>`).join('') + '</ul>'; taskDetailContentEl.innerHTML = `<h3>Info</h3><p><strong>Fase:</strong> ${task.Fase}</p><p><strong>Beskrivelse:</strong> ${task.Beskrivelse || 'Ingen.'}</p><p><strong>Ansvarlig Rolle:</strong> ${role?.RolleNavn || '?'}</p><p><strong>Ansvarlig(e):</strong> ${respUsers.map(u => `<span class="clickable-user" data-user-id="${u.BrukerID}">${u.Navn}</span>`).join(', ') || 'Ingen'}</p><h3>Status & Tid</h3><p><strong>Status:</strong> ${task.Status}</p>${task.Status === 'Problem Rapportert' ? `<p style="color:var(--status-problem)"><strong>Problem:</strong> ${task.ProblemBeskrivelse || 'Problem'}</p>` : ''}${task.Status === 'Venter på Godkjenning' ? `<p style="color:var(--status-pending-approval)"><strong>Venter på ledergodkjenning.</strong></p>` : ''}<p><strong>Est. Varighet:</strong> <input type="number" id="durationInput_${task.OppgaveID}" value="${task.EstimertVarighetDager ?? ''}" min="0" step="1" ${canEditDuration(task) ? '' : 'disabled'} style="width:60px; margin-left:5px;"> dager ${canEditDuration(task) ? `<button class="save-duration-button" data-task-id="${task.OppgaveID}">Lagre</button>` : ''}</p><p><strong>Beregnet Start:</strong> ${formatDate(task.BeregnetStartDato)}</p><p><strong>Beregnet Slutt:</strong> ${formatDate(task.BeregnetSluttDato)}</p><p><strong>Faktisk Start:</strong> ${formatDate(task.FaktiskStartDato)}</p><p><strong>Faktisk Slutt:</strong> ${formatDate(task.FaktiskSluttDato)}</p><div class="task-detail-actions">${generateActionButtons(task)}</div><h3>Avhengigheter</h3><p><strong>Forutsetninger:</strong></p>${preHtml}<p><strong>Etterfølgende:</strong></p>${succHtml}<h3>Kommunikasjon</h3><textarea id="taskCommentInput" placeholder="Legg til notat..."></textarea><button id="addTaskCommentButton">Legg til Notat</button><ul id="taskCommentsList"><li>Ingen notater.</li></ul><div class="user-selector" style="margin-top:20px; padding-top:15px; border-top:1px solid var(--gray-medium);"><label for="taskDetailUserSelect">Vis som:</label><select id="taskDetailUserSelect"></select></div>`; populateTaskDetailUserSelector(taskId); addTaskDetailEventListeners(task);
}

/**
 * Populates the user selector within the task detail view.
 */
 function populateTaskDetailUserSelector(taskId) { /* ... (uendret) ... */
    const sel = document.getElementById('taskDetailUserSelect'); if (!sel || !users) return; sel.innerHTML = ''; users.forEach(u => { const o = document.createElement('option'); o.value = u.BrukerID; o.textContent = `${u.Navn} (${getRolesForUser(u).map(r => r.RolleNavn).join(', ')})`; sel.appendChild(o); }); if (currentUser) sel.value = currentUser.BrukerID; sel.removeEventListener('change', handleTaskDetailUserChange); sel.addEventListener('change', handleTaskDetailUserChange);
}

/**
 * Renders the user list table FOR THE LOADED PROJECT.
 */
function renderUserList() { /* ... (uendret) ... */
    userListBodyEl.innerHTML = ''; if (!users?.length) { userListBodyEl.innerHTML = '<tr><td colspan="4">Ingen brukere.</td></tr>'; return; } users.forEach(u => { const roles = getRolesForUser(u).map(r => r.RolleNavn).join(', '); const tr = document.createElement('tr'); tr.innerHTML = `<td>${u.Navn}</td><td>${roles}</td><td>${u.Firma}</td><td>${u.Epost} | ${u.Telefon}</td>`; userListBodyEl.appendChild(tr); });
}

/**
 * Renders the Dependencies view FOR THE LOADED PROJECT.
 */
function renderDependenciesView() { /* ... (uendret) ... */
    if (!currentUser || !tasks) { waitingForListEl.innerHTML = '<li>Velg bruker.</li>'; waitingOnMeListEl.innerHTML = '<li>Velg bruker.</li>'; return; } waitingForListEl.innerHTML = ''; const myWaiting = tasks.filter(t => currentUser.RolleIDs.includes(t.AnsvarligRolleID) && (t.Status === 'Ikke startet' || t.Status === 'Venter på forutsetning')); let waitingFound = false; myWaiting.forEach(myT => { const unmet = myT.ForutsetningerIDs.map(findTaskById).filter(p => p && p.Status !== 'Utført'); if (unmet.length > 0) { waitingFound = true; const li = document.createElement('li'); li.innerHTML = `For <strong>${myT.OppgaveNr}. ${myT.OppgaveNavn}</strong>, venter på: <ul>${unmet.map(p => `<li>${p.OppgaveNr}. ${p.OppgaveNavn} (${p.Status})</li>`).join('')}</ul>`; waitingForListEl.appendChild(li); } }); if (!waitingFound) waitingForListEl.innerHTML = '<li>Ingen uferdige forutsetninger.</li>'; waitingOnMeListEl.innerHTML = ''; const myActive = tasks.filter(t => currentUser.RolleIDs.includes(t.AnsvarligRolleID) && t.Status !== 'Utført'); let waitingOnMeFound = false; myActive.forEach(myT => { const succ = tasks.filter(st => st.ForutsetningerIDs?.includes(myT.OppgaveID) && (st.Status === 'Ikke startet' || st.Status === 'Venter på forutsetning')); if (succ.length > 0) { waitingOnMeFound = true; const li = document.createElement('li'); const roles = [...new Set(succ.map(st => getRoleById(st.AnsvarligRolleID)?.RolleNavn || '?'))]; li.innerHTML = `Fordi <strong>${myT.OppgaveNr}. ${myT.OppgaveNavn}</strong> (${myT.Status}) ikke er utført, venter: <ul>${succ.map(st => `<li>${st.OppgaveNr}. ${st.OppgaveNavn} (${getRoleById(st.AnsvarligRolleID)?.RolleNavn || '?'})</li>`).join('')}</ul> (Roller: ${roles.join(', ')})`; waitingOnMeListEl.appendChild(li); } }); if (!waitingOnMeFound) waitingOnMeListEl.innerHTML = '<li>Ingen oppgaver venter på dine.</li>';
}

/**
 * Renders the simulated messages/notifications list.
 */
 function renderMessages(targetListElement = messageListContainerEl, maxItems = null) { /* ... (uendret) ... */
     if (!targetListElement) return; targetListElement.innerHTML = ''; if (!notifications.length) { targetListElement.innerHTML = '<li>Ingen meldinger/varsler.</li>'; return; } const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp); const items = maxItems ? sorted.slice(0, maxItems) : sorted; items.forEach(n => { const li = document.createElement('li'); let c = ''; if (n.type === 'message') { const s = findUserById(n.senderId), r = findUserById(n.recipientId); c = `<strong>Melding fra: ${s?.Navn || '?'} til ${r?.Navn || '?'}</strong><small>${formatDate(n.timestamp, true)}</small><p><em>${n.subject || '(Uten emne)'}</em></p><p>${n.body}</p>`; } else c = `<strong>Systemvarsel</strong><small>${formatDate(n.timestamp, true)}</small><p>${n.body}</p>`; li.innerHTML = c; targetListElement.appendChild(li); });
}

/**
 * Renders just the notifications list.
 */
function renderNotificationsList(targetListElement, maxItems = null) { /* ... (uendret) ... */
    if (!targetListElement) return; targetListElement.innerHTML = ''; if (!notifications.length) { targetListElement.innerHTML = '<li>Ingen hendelser.</li>'; return; } const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp); const items = maxItems ? sorted.slice(0, maxItems) : sorted; items.forEach(n => { const li = document.createElement('li'); li.innerHTML = `<small>${formatDate(n.timestamp, true)}:</small> ${n.body}`; if (n.body.includes("klar til start")) { li.style.backgroundColor = 'var(--status-waiting)'; li.style.borderLeft = '3px solid var(--accent-color)'; } if (n.taskId) { li.style.cursor = 'pointer'; li.onclick = () => showTaskDetail(n.taskId); } targetListElement.appendChild(li); });
}

/**
 * Generates the HTML for action buttons in the task detail view
 */
function generateActionButtons(task) { /* ... (uendret) ... */
    let btns = ''; if (!currentUser) return btns; const isPL = currentUser.RolleIDs.includes('ROLLE-PL'); const isResp = currentUser.RolleIDs.includes(task.AnsvarligRolleID); if (isResp) { if (task.Status === 'Ikke startet' || task.Status === 'Venter på forutsetning') { const canStart = arePrerequisitesMet(task); btns += `<button class="start-task-button" data-task-id="${task.OppgaveID}" ${!canStart ? 'disabled title="Forutsetninger ikke møtt"' : ''}>Start Arbeid</button>`; } if (task.Status === 'Pågår') btns += `<button class="complete-task-button" data-task-id="${task.OppgaveID}">Marker Utført (Send til godkjenning)</button>`; if (task.Status !== 'Utført' && task.Status !== 'Problem Rapportert') btns += `<button class="problem-button" data-task-id="${task.OppgaveID}">Rapporter Problem</button>`; } if (isPL) { if (task.Status === 'Venter på Godkjenning') { btns += `<button class="approve-button" data-task-id="${task.OppgaveID}">Godkjenn Utført</button><button class="reject-button" data-task-id="${task.OppgaveID}">Avvis</button>`; } if (task.Status === 'Problem Rapportert') btns += `<button class="resolve-problem-button" data-task-id="${task.OppgaveID}">Marker Problem Løst</button>`; } return btns;
}

// === 5.3: RENDERING FUNCTIONS END ===


// === 5.4: EVENT HANDLERS START ===

/**
 * Sets up all initial event listeners.
 */
function setupEventListeners() { /* ... (uendret) ... */
    userSelect.addEventListener('change', handleUserChange); navButtons.forEach(b => b.addEventListener('click', handleNavClick)); phaseFilterEl.addEventListener('change', renderFullTaskList); statusFilterEl.addEventListener('change', renderFullTaskList); backToListButton.addEventListener('click', () => { if (!currentUser) return; const v = currentUser.RolleIDs.includes('ROLLE-PL') ? 'taskList' : 'myTasks'; switchView(v); renderApp(); }); newMessageButton.addEventListener('click', () => { newMessageModal.style.display = 'block'; messageSubjectEl.value = ''; messageBodyEl.value = ''; }); cancelMessageButton.addEventListener('click', () => newMessageModal.style.display = 'none'); sendMessageButton.addEventListener('click', handleSendMessage); taskDetailContentEl.addEventListener('click', handleTaskDetailClicks);
    // Add listener for project list view if container exists
     if (userProjectListContainerEl) {
        userProjectListContainerEl.addEventListener('click', handleProjectListClicks);
    }
}

/**
 * Handles clicks within the task detail view using event delegation.
 */
function handleTaskDetailClicks(event) { /* ... (uendret) ... */
    if (!currentUser) return; const target = event.target; const taskId = target.dataset.taskId; const durInput = taskDetailContentEl.querySelector('input[id^="durationInput_"]'); const currentTaskId = durInput ? durInput.id.split('_')[1] : null; const currentTask = currentTaskId ? findTaskById(currentTaskId) : null; if (target.classList.contains('start-task-button') && taskId) updateTaskStatus(taskId, 'Pågår'); else if (target.classList.contains('complete-task-button') && taskId) updateTaskStatus(taskId, 'Venter på Godkjenning'); else if (target.classList.contains('approve-button') && taskId) updateTaskStatus(taskId, 'Utført', { godkjent: true }); else if (target.classList.contains('reject-button') && taskId) { updateTaskStatus(taskId, 'Pågår'); addNotification('system', `Oppg ${findTaskById(taskId)?.OppgaveNr} avvist -> 'Pågår'.`, null, taskId); } else if (target.classList.contains('problem-button') && taskId) reportProblem(taskId); else if (target.classList.contains('resolve-problem-button') && taskId) resolveProblem(taskId); else if (target.classList.contains('save-duration-button') && taskId) handleSaveDuration(taskId); else if (target.id === 'addTaskCommentButton') { const input = document.getElementById('taskCommentInput'); if (input?.value.trim() && currentTask) { addNotification('system', `Notat Oppg ${currentTask.OppgaveNr}: "${input.value.trim()}"`, currentUser.BrukerID, currentTask.OppgaveID); input.value = ''; renderMessages(); renderNotificationsList(latestNotificationsListEl, 5); } } else if (target.classList.contains('clickable-user') && target.dataset.userId) { const user = findUserById(target.dataset.userId); if (user && currentTask) { currentUser = user; userSelect.value = user.BrukerID; showTaskDetail(currentTask.OppgaveID); addNotification('system', `Viser som: ${user.Navn}`, null); } }
}

/**
 * NEW: Handles clicks within the project list view (save button).
 */
 function handleProjectListClicks(event) {
    if (!currentUser) return;
    const target = event.target;

    if (target.classList.contains('save-project-settings-button')) {
        const row = target.closest('tr');
        const projectId = row.dataset.projectId;
        const priorityInput = row.querySelector('.priority-input');
        const availabilityInput = row.querySelector('.availability-input');

        const newPriority = parseInt(priorityInput.value, 10);
        const newAvailability = availabilityInput.value.trim();

        // Find the project entry in the current user's data
        const userProject = currentUser.projects?.find(p => p.projectId === projectId);

        if (userProject) {
            let changed = false;
            if (!isNaN(newPriority) && newPriority >= 1 && userProject.userPriority !== newPriority) {
                userProject.userPriority = newPriority;
                changed = true;
            } else if (isNaN(newPriority) || newPriority < 1) {
                // Reset input if invalid
                priorityInput.value = userProject.userPriority || '';
            }

            if (userProject.availability !== newAvailability) {
                userProject.availability = newAvailability || "Ikke satt"; // Use default if empty
                changed = true;
            }

            if (changed) {
                console.log(`User ${currentUser.Navn} updated settings for project ${projectId}: Priority=${userProject.userPriority}, Availability=${userProject.availability}`);
                addNotification('system', `Innstillinger for prosjekt '${userProject.projectName}' lagret (Prioritet: ${userProject.userPriority}, Tilgj.: ${userProject.availability})`);
                // Re-render the project list to reflect sorting changes if priority was updated
                renderProjectList();
            }
        } else {
            console.error("Could not find project in user data:", projectId);
        }
    }
}


/**
 * Handles changes in the global user selector.
 */
function handleUserChange() { /* ... (uendret) ... */
    currentUser = findUserById(userSelect.value); if (!currentUser) { console.error("User not found!"); return; } console.log("User changed:", currentUser.Navn); addNotification('system', `Viser som: ${currentUser.Navn}`, null); currentView = currentUser.RolleIDs.includes('ROLLE-PL') ? 'dashboard' : 'myTasks'; renderApp();
}

/**
 * Handles changes in the task detail user selector.
 */
function handleTaskDetailUserChange(event) { /* ... (uendret) ... */
    const user = findUserById(event.target.value); const durInput = taskDetailContentEl.querySelector('input[id^="durationInput_"]'); const taskId = durInput ? durInput.id.split('_')[1] : null; if (user && taskId) { currentUser = user; userSelect.value = user.BrukerID; showTaskDetail(taskId); addNotification('system', `Viser som: ${user.Navn}`, null); }
}

/**
 * Handles clicks on the main navigation buttons.
 */
function handleNavClick(event) {
    const targetView = event.target.dataset.targetView;
    if (targetView) {
        currentView = targetView;
        if (projectData && userData) {
            switchView(targetView);
            updateActiveNavButton();
            // Render specific views when navigated to
            if (targetView === 'messages') renderMessages();
            if (targetView === 'dependencies') renderDependenciesView();
            if (targetView === 'taskList') renderFullTaskList();
            if (targetView === 'myTasks') renderMyTasksList();
            if (targetView === 'projectList') renderProjectList(); // Render new view
            if (targetView === 'users') renderUserList();

        } else {
            console.warn("Nav attempt before data load.");
            const el = document.querySelector('#appContent p[style*="color: red;"], #appContent p[style*="color: orange;"]');
             if (!el) appContent.innerHTML = '<p style="color: orange;">Data lastes...</p>';
        }
    }
}

/**
 * Handles saving the duration for a task.
 */
function handleSaveDuration(taskId) { /* ... (uendret) ... */
    const t = findTaskById(taskId); const i = document.getElementById(`durationInput_${taskId}`); if (!t || !i) return; const v = i.value; const d = v === '' ? null : parseInt(v, 10); if (v === '' || (!isNaN(d) && d >= 0)) { if (t.EstimertVarighetDager !== d) { const o = t.EstimertVarighetDager; t.EstimertVarighetDager = d; console.log(`Duration ${taskId} -> ${d ?? 'null'}`); addNotification('system', `Varighet Oppg ${t.OppgaveNr} endret fra ${o ?? 'N/A'} til ${d ?? 'N/A'} av ${currentUser.Navn}.`, currentUser.BrukerID, t.OppgaveID); recalculateTaskDates(t); renderApp(); showTaskDetail(taskId); } } else { alert("Ugyldig tall."); i.value = t.EstimertVarighetDager ?? ''; }
}

/**
 * Handles sending a simulated message.
 */
function handleSendMessage() { /* ... (uendret) ... */
    const rId=messageRecipientEl.value; const s=messageSubjectEl.value.trim(); const b=messageBodyEl.value.trim(); if(!currentUser){alert("Ingen bruker valgt.");return;} if(!rId||!b){alert('Velg mottaker og skriv melding.');return;} addNotification('message',b,currentUser.BrukerID,null,rId,s); newMessageModal.style.display='none'; renderMessages(); renderNotificationsList(latestNotificationsListEl,5);
}

/**
 * Attaches event listeners specific to the task detail view elements.
 */
function addTaskDetailEventListeners(task) { /* Delegation handles most */ }

// === 5.4: EVENT HANDLERS END ===


// === 5.5: TASK ACTIONS & LOGIC START ===

/**
 * Updates the status of a task and handles related side effects.
 */
function updateTaskStatus(taskId, newStatus, options = {}) { /* ... (uendret) ... */
    const task=findTaskById(taskId); if(!task)return; const oldStatus=task.Status; if(oldStatus===newStatus&&newStatus!=='Utført')return; console.log(`Status ${taskId}: ${oldStatus} -> ${newStatus}`); task.Status=newStatus; task.JustMadeReady=false; if(newStatus==='Pågår'){if(!task.FaktiskStartDato)task.FaktiskStartDato=new Date(); task.GodkjentAvLeder=false; task.ProblemBeskrivelse=null;} if(newStatus==='Venter på Godkjenning'){task.GodkjentAvLeder=false; task.ProblemBeskrivelse=null;}else if(newStatus==='Utført'){task.FaktiskSluttDato=new Date(); task.GodkjentAvLeder=options.godkjent||task.GodkjentAvLeder; task.ProblemBeskrivelse=null; triggerSuccessorUpdate(taskId);} recalculateDependentTaskDates(task); addNotification('system',`Status Oppg ${task.OppgaveNr} -> '${newStatus}' av ${currentUser.Navn}.`,currentUser.BrukerID,taskId); renderApp(); if(taskDetailViewEl.classList.contains('active-view')){const durInput=taskDetailContentEl.querySelector('input[id^="durationInput_"]'); const currentId=durInput?durInput.id.split('_')[1]:null; if(currentId===taskId)showTaskDetail(taskId);}
}

/**
 * Checks prerequisites for dependent tasks and updates their status.
 */
function triggerSuccessorUpdate(completedTaskId) { /* ... (uendret) ... */
    console.log(`Task ${completedTaskId} done, check successors...`); tasks.forEach(task=>{if(task.ForutsetningerIDs?.includes(completedTaskId)){if(task.Status==='Venter på forutsetning'||task.Status==='Ikke startet'){const wasWaiting=task.Status==='Venter på forutsetning'; if(arePrerequisitesMet(task)){task.Status='Ikke startet'; task.JustMadeReady=wasWaiting; task.BeregnetStartDato=calculateEarliestStartDate(task); addNotification('system',`Oppgave ${task.OppgaveNr} (${task.OppgaveNavn}) er klar til start!`,null,task.OppgaveID); recalculateTaskDates(task);}else{task.Status='Venter på forutsetning'; task.JustMadeReady=false;}}}});
}

/**
 * Checks if all prerequisites for a given task are met.
 */
function arePrerequisitesMet(task) { /* ... (uendret) ... */
    if(!task.ForutsetningerIDs?.length)return true; return task.ForutsetningerIDs.every(id=>findTaskById(id)?.Status==='Utført');
}

/**
 * Recalculates the end date for a task and triggers recalculation for successors.
 */
function recalculateTaskDates(task) { /* ... (uendret) ... */
    if(!task)return; console.log(`Recalc dates Task ${task.OppgaveNr}`); let chg=false; const oS=task.BeregnetStartDato, oE=task.BeregnetSluttDato; const nS=calculateEarliestStartDate(task); if(nS!==null&&(!oS||oS.getTime()!==nS.getTime())){task.BeregnetStartDato=nS; chg=true; console.log(`  - New Start: ${formatDate(nS)}`);}else if(nS===null&&oS!==null){task.BeregnetStartDato=null; chg=true; console.log(`  - Clear Start`);} if(task.BeregnetStartDato&&task.EstimertVarighetDager!==null){const nE=addWorkDays(task.BeregnetStartDato,task.EstimertVarighetDager); if(nE!==null&&(!oE||oE.getTime()!==nE.getTime())){task.BeregnetSluttDato=nE; chg=true; console.log(`  - New End: ${formatDate(nE)}`);}else if(nE===null&&oE!==null){task.BeregnetSluttDato=null; chg=true; console.log(`  - Clear End (addWorkDays)`);}}else{if(oE!==null){task.BeregnetSluttDato=null; chg=true; console.log(`  - Clear End (no start/dur)`);}} if(chg)recalculateDependentTaskDates(task);
}

/**
 * Recalculates dates for tasks that depend on the provided task.
 */
function recalculateDependentTaskDates(prerequisiteTask) { /* ... (uendret) ... */
    const succ=tasks.filter(t=>t.ForutsetningerIDs?.includes(prerequisiteTask.OppgaveID)); console.log(`  - Found ${succ.length} successors for Task ${prerequisiteTask.OppgaveNr}. Recalc...`); succ.forEach(s=>recalculateTaskDates(s));
}

/**
 * Calculates the earliest possible start date for a task.
 */
 function calculateEarliestStartDate(task) { /* ... (uendret) ... */
    if(!task.ForutsetningerIDs?.length){const p=projectData?.project?.StartDato?new Date(projectData.project.StartDato):new Date(); p.setHours(0,0,0,0); return p;} let latest=null; for(const id of task.ForutsetningerIDs){const p=findTaskById(id); if(!p)return null; const e=p.FaktiskSluttDato||p.BeregnetSluttDato; if(!e||!(e instanceof Date)||isNaN(e))return null; if(!latest||e>latest)latest=e;} if(latest){const n=new Date(latest); n.setDate(n.getDate()+1); n.setHours(0,0,0,0); const p=projectData?.project?.StartDato?new Date(projectData.project.StartDato):new Date(1970,0,1); p.setHours(0,0,0,0); return n>p?n:p;} return null;
}

/**
 * Simulates reporting a problem for a task.
 */
function reportProblem(taskId) { /* ... (uendret) ... */
    const t=findTaskById(taskId); if(!t||t.Status==='Utført'||!currentUser)return; const r=prompt(`Beskriv problem Oppg ${t.OppgaveNr}:`,t.ProblemBeskrivelse||''); if(r!==null){t.ProblemBeskrivelse=r.trim()||"Problem"; updateTaskStatus(taskId,'Problem Rapportert'); addNotification('system',`Problem rapportert Oppg ${t.OppgaveNr} av ${currentUser.Navn}: "${t.ProblemBeskrivelse}"`,currentUser.BrukerID,taskId);}
}

/**
 * Simulates resolving a problem for a task.
 */
function resolveProblem(taskId) { /* ... (uendret) ... */
    const t=findTaskById(taskId); if(!t||t.Status!=='Problem Rapportert'||!currentUser)return; let ps='Pågår'; if(!t.FaktiskStartDato){ps=arePrerequisitesMet(t)?'Ikke startet':'Venter på forutsetning';} t.ProblemBeskrivelse=null; updateTaskStatus(taskId,ps); addNotification('system',`Problem Oppg ${t.OppgaveNr} løst av ${currentUser.Navn}. Status -> '${ps}'.`,currentUser.BrukerID,taskId);
}

/**
 * Admin action to mark a task as fully complete.
 */
 function adminMarkTaskComplete(taskId) { /* ... (uendret) ... */
    const t=findTaskById(taskId); if(!t||!currentUser?.RolleIDs.includes('ROLLE-PL'))return; console.log(`Admin completing ${taskId}`); if(!t.FaktiskStartDato)t.FaktiskStartDato=new Date(); if(!t.FaktiskSluttDato)t.FaktiskSluttDato=new Date(); t.Status='Utført'; t.GodkjentAvLeder=true; t.ProblemBeskrivelse=null; addNotification('system',`Oppg ${t.OppgaveNr} hurtigfullført av Admin.`,currentUser.BrukerID,taskId); triggerSuccessorUpdate(taskId); recalculateDependentTaskDates(t); renderApp(); if(taskDetailViewEl.classList.contains('active-view')){const dI=taskDetailContentEl.querySelector('input[id^="durationInput_"]'); const cId=dI?dI.id.split('_')[1]:null; if(cId===taskId)showTaskDetail(taskId);}
}

/**
 * Determines if the current user can edit the duration of a task.
 */
function canEditDuration(task) { /* ... (uendret) ... */
    if(!currentUser)return false; const isPL=currentUser.RolleIDs.includes('ROLLE-PL'); const isR=currentUser.RolleIDs.includes(task.AnsvarligRolleID); return(isPL||isR)&&task.Status!=='Utført';
}

/**
 * Gets a list of pending actions for a specific user FOR THE LOADED PROJECT.
 */
 function getPendingActionsForUser(user) { /* ... (uendret - opererer på global 'tasks') ... */
    if(!user||!tasks)return[]; const act=[]; const isPL=user.RolleIDs.includes('ROLLE-PL'); tasks.forEach(t=>{const isR=user.RolleIDs.includes(t.AnsvarligRolleID); if(isR&&t.Status==='Ikke startet'&&arePrerequisitesMet(t))act.push({type:'Start Oppgave',task:t}); if(isPL&&t.Status==='Venter på Godkjenning')act.push({type:'Godkjenn Oppgave',task:t}); if(isPL&&t.Status==='Problem Rapportert')act.push({type:'Løs Problem',task:t});}); act.sort((a,b)=>{const o={"Løs Problem":1, "Godkjenn Oppgave":2, "Start Oppgave":3}; return(o[a.type]||99)-(o[b.type]||99);}); return act;
}

// === 5.5: TASK ACTIONS & LOGIC END ===


// === 5.6: UTILITY FUNCTIONS START ===
function findTaskById(taskId) { return tasks?.find(t => t.OppgaveID === taskId); }
function findUserById(userId) { return users?.find(u => u.BrukerID === userId); }
function getRoleById(roleId) { return roles?.find(r => r.RolleID === roleId); }
function findUsersByRole(roleId) { return users?.filter(u => u.RolleIDs.includes(roleId)) ?? []; }
function getRolesForUser(user) { return user?.RolleIDs?.map(id => getRoleById(id)).filter(r => r) ?? []; }
function formatDate(date, includeTime = false) { if (!date || !(date instanceof Date) || isNaN(date)) return 'N/A'; try { const d=String(date.getDate()).padStart(2,'0'); const m=String(date.getMonth()+1).padStart(2,'0'); const y=date.getFullYear(); let f=`${d}.${m}.${y}`; if(includeTime){const h=String(date.getHours()).padStart(2,'0'); const min=String(date.getMinutes()).padStart(2,'0'); f+=` ${h}:${min}`; } return f; } catch(e){console.error("Date fmt err:", date, e); return 'Feil dato';} }
function addWorkDays(startDate, days) { if (!startDate || !(startDate instanceof Date) || isNaN(startDate) || days === null || isNaN(days) || days < 0) { console.warn("Invalid addWorkDays", startDate, days); return null; } let d = new Date(startDate); let added = 0, safety = 0; while (added < days && safety < (days * 5 + 100)) { d.setDate(d.getDate() + 1); const day = d.getDay(); if (day !== 0 && day !== 6) added++; safety++; } if (safety >= (days * 5 + 100)) { console.error("addWorkDays safety triggered"); return null; } d.setHours(0,0,0,0); return d; }
function calculateProjectProgress() { if (!tasks?.length) return 0; const c=tasks.filter(t => t.Status === 'Utført').length; return Math.round((c / tasks.length) * 100); }
function calculateProjectEta() { if (!tasks?.length) return 'Ukjent'; let l=null; tasks.forEach(t => { const e=t.BeregnetSluttDato; if (e instanceof Date && !isNaN(e)) { if (!l || e > l) l=e; } }); return l ? formatDate(l) : 'Ukjent'; }
function addNotification(type, body, senderId=null, taskId=null, recipientId=null, subject=null) { const n={id:`notif-${Date.now()}-${Math.random()}`, type, body, senderId, recipientId, subject, taskId, timestamp:new Date(), read:false}; notifications.push(n); console.log("Notif added:", n); if (latestNotificationsListEl) renderNotificationsList(latestNotificationsListEl, 5); if (messageListContainerEl && currentView === 'messages') renderMessages(); }
// === 5.6: UTILITY FUNCTIONS END ===


// === 5.7: VIEW MANAGEMENT START ===
function switchView(viewId) { console.log("Switch view:", viewId); document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view')); const target=document.getElementById(viewId); if(target){ target.classList.add('active-view'); currentView=viewId; }else{ console.error(`View ${viewId} not found! Fallback.`); const d=document.getElementById('dashboard'); if(d){d.classList.add('active-view'); currentView='dashboard';}else appContent.innerHTML=`<p style="color:red;">FEIL: Finner ingen visninger!</p>`;} }
function updateActiveNavButton() { navButtons.forEach(b => b.classList.toggle('active', b.dataset.targetView === currentView)); }
// === 5.7: VIEW MANAGEMENT END ===


// === 5.8: APPLICATION STARTUP ===
document.addEventListener('DOMContentLoaded', init);
// === 5.8: APPLICATION STARTUP END ===

// === 5.9: CSS Blinking Animation & Action Styles START ===
const dynamicStyles = `
@keyframes blinkBackground { 0%, 100% { background-color: inherit; } 50% { background-color: var(--status-waiting); } }
.card-pending-actions.has-actions { border-left: 5px solid var(--accent-color); background-color: #fffadf; } /* Highlight card */
#pendingActionsList li { padding: 8px 10px; margin-bottom: 5px; border-radius: 3px; border: 1px solid var(--gray-medium); transition: background-color 0.2s ease; border-left-width: 4px; }
#pendingActionsList li:hover { background-color: var(--gray-light); }
#pendingActionsList .action-icon { display: inline-block; margin-right: 8px; font-weight: bold; }
#pendingActionsList .action-problem { border-left-color: var(--status-problem); }
#pendingActionsList .action-approval { border-left-color: var(--status-pending-approval); }
#pendingActionsList .action-start { border-left-color: var(--status-completed); }
#pendingActionsList .action-icon.problem { color: var(--status-problem); }
#pendingActionsList .action-icon.approval { color: var(--status-pending-approval); }
#pendingActionsList .action-icon.start { color: var(--status-completed); }
#pendingActionsList .highest-priority-action { border: 2px solid var(--primary-color); background-color: #e7f1ff; font-weight: 600; }
.task-item .cue { margin-left: 10px; font-size: 0.9em; padding: 2px 5px; border-radius: 3px; }
.task-item .cue-approval { background-color: var(--status-pending-approval); color: white;}
.task-item .cue-problem { background-color: var(--status-problem); color: white;}
.task-item .cue-ready { background-color: var(--status-completed); color: white;}
.project-list-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
.project-list-table th, .project-list-table td { border: 1px solid var(--gray-medium); padding: 8px; text-align: left; }
.project-list-table th { background-color: var(--gray-light); }
.project-list-table input[type="number"], .project-list-table input[type="text"] { width: 90%; }
`;
const styleSheet = document.createElement("style"); styleSheet.type = "text/css"; styleSheet.innerText = dynamicStyles; document.head.appendChild(styleSheet);
// === 5.9: CSS Blinking Animation & Action Styles END ===

// === 5: MAIN APPLICATION SCRIPT END ===
