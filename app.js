document.addEventListener('DOMContentLoaded', () => {
    const formulaNameInput = document.getElementById('formulaName');
    const formulaExpressionInput = document.getElementById('formulaExpression');
    const addFormulaButton = document.getElementById('addFormula');
    const formulasList = document.getElementById('formulas');
    const formulaSelect = document.getElementById('formulaSelect');
    const variablesInputDiv = document.getElementById('variablesInput');
    const calculateButton = document.getElementById('calculate');
    const resultOutput = document.getElementById('result');

    let formulas = JSON.parse(localStorage.getItem('formulas')) || [];

    // Отображение формул
    function renderFormulas() {
        formulasList.innerHTML = '';
        formulaSelect.innerHTML = '';
        formulas.forEach((formula, index) => {
            // Добавление в список
            const li = document.createElement('li');
            li.textContent = `${formula.name}: ${formula.expression}`;

            // Кнопка удаления
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.classList.add('delete-button');
            deleteButton.addEventListener('click', () => deleteFormula(index));

            li.appendChild(deleteButton);
            formulasList.appendChild(li);

            // Добавление в выпадающий список
            const option = document.createElement('option');
            option.value = index;
            option.textContent = formula.name;
            formulaSelect.appendChild(option);
        });
    }

    // Добавление формулы
    addFormulaButton.addEventListener('click', () => {
        const name = formulaNameInput.value.trim();
        const expression = formulaExpressionInput.value.trim();

        if (name && expression) {
            formulas.push({ name, expression });
            localStorage.setItem('formulas', JSON.stringify(formulas));
            renderFormulas();
            formulaNameInput.value = '';
            formulaExpressionInput.value = '';
        }
    });

    // Удаление формулы
    function deleteFormula(index) {
        formulas.splice(index, 1);
        localStorage.setItem('formulas', JSON.stringify(formulas));
        renderFormulas();
    }

    // Отображение полей для ввода переменных
    formulaSelect.addEventListener('change', () => {
        const selectedFormula = formulas[formulaSelect.value];
        if (selectedFormula) {
            const variables = selectedFormula.expression.match(/[a-zA-Z]+/g) || [];
            variablesInputDiv.innerHTML = variables.map(variable => `
                <label>${variable}:</label>
                <input type="number" id="${variable}" placeholder="Enter value for ${variable}">
            `).join('');
        }
    });

    // Вычисление результата
    calculateButton.addEventListener('click', () => {
        const selectedFormula = formulas[formulaSelect.value];
        if (selectedFormula) {
            const variables = selectedFormula.expression.match(/[a-zA-Z]+/g) || [];
            const values = variables.reduce((acc, variable) => {
                acc[variable] = parseFloat(document.getElementById(variable).value);
                return acc;
            }, {});

            try {
                const result = eval(selectedFormula.expression.replace(/[a-zA-Z]+/g, match => values[match]));
                resultOutput.textContent = `Result: ${result}`;
            } catch (error) {
                resultOutput.textContent = 'Error in calculation';
            }
        }
    });

    // Инициализация
    renderFormulas();
});