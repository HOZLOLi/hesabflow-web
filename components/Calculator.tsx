
import React, { useState, useEffect, useRef } from 'react';
import { History, Trash2, Delete, Calculator as CalculatorIcon } from 'lucide-react';
import { useWindowStore } from '../store/windowStore';

interface Calculation {
    id: string;
    expression: string;
    result: string;
}

export const Calculator: React.FC = () => {
    const [input, setInput] = useState('');
    const [result, setResult] = useState('');
    const [history, setHistory] = useState<Calculation[]>([]);
    const [isResultFinal, setIsResultFinal] = useState(false);

    // Identify the active window so we don't steal global keystrokes
    // (digits / Backspace / Enter / Escape) when Calculator is in the
    // background. Without this gate, typing in any other open form
    // would route here and `e.preventDefault()` would suppress the input.
    const { activeWindowId, windows } = useWindowStore();
    const isCalculatorActive = (() => {
        const active = windows.find(w => w.id === activeWindowId);
        return active?.type === 'CALCULATOR' && !active.isMinimized;
    })();

    const displayRef = useRef<HTMLDivElement>(null);

    // Formats numbers within the expression string (e.g. "2000+500" -> "2,000 + 500")
    const formatExpression = (expr: string) => {
        return expr
            .replace(/\*/g, ' × ')
            .replace(/\//g, ' ÷ ')
            .replace(/\+/g, ' + ')
            .replace(/-/g, ' - ')
            .replace(/\d+(?:\.\d+)?/g, (match) => {
                // Determine if it has decimal
                if (match.includes('.')) {
                    const [int, dec] = match.split('.');
                    return Number(int).toLocaleString('en-US') + '.' + dec;
                }
                return Number(match).toLocaleString('en-US');
            });
    };

    const handleInput = (val: string) => {
        if (isResultFinal) {
            // If starting new calculation after a result
            if (['+', '-', '*', '/', '%'].includes(val)) {
                // Continue with previous result
                setInput(result + val);
            } else {
                // Start fresh
                setInput(val);
            }
            setIsResultFinal(false);
            setResult('');
        } else {
            setInput(prev => prev + val);
        }
    };

    const handleCalculate = () => {
        if (!input) return;
        
        try {
            // Prepare string for evaluation (handle percentages, replace visual operators)
            let evalString = input
                .replace(/×/g, '*')
                .replace(/÷/g, '/');
            
            // Handle percentage (simple approach: number% -> number/100)
            // Note: complex % logic (like 100 + 10%) needs more parsing, 
            // here we treat 10% as 0.1
            evalString = evalString.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

            // Safety check: ensure only valid math chars
            if (!/^[\d.+\-*/()% ]+$/.test(evalString)) {
                throw new Error("Invalid characters");
            }

            // Evaluate
            // eslint-disable-next-line no-new-func
            const rawResult = new Function('return ' + evalString)();
            
            if (!isFinite(rawResult) || isNaN(rawResult)) {
                throw new Error("Invalid result");
            }

            // Format result to avoid long decimals
            const formattedResult = parseFloat(Number(rawResult).toFixed(8)).toString();

            setHistory(prev => [{
                id: crypto.randomUUID(),
                expression: input,
                result: formattedResult
            }, ...prev].slice(0, 50));

            setResult(formattedResult);
            setInput(formattedResult);
            setIsResultFinal(true);
        } catch (e) {
            setResult('Error');
            setIsResultFinal(true);
        }
    };

    const handleClear = () => {
        setInput('');
        setResult('');
        setIsResultFinal(false);
    };

    const handleBackspace = () => {
        if (isResultFinal) {
            handleClear();
        } else {
            setInput(prev => prev.slice(0, -1));
        }
    };

    // Auto-scroll display
    useEffect(() => {
        if (displayRef.current) {
            displayRef.current.scrollLeft = displayRef.current.scrollWidth;
        }
    }, [input]);

    // Keyboard support — only active when Calculator is the focused window.
    useEffect(() => {
        if (!isCalculatorActive) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key;

            // Numbers & Dot
            if (/[0-9.]/.test(key)) {
                e.preventDefault(); // Prevent browser search etc
                handleInput(key);
            }

            // Operators
            if (['+', '-', '(', ')', '%'].includes(key)) {
                e.preventDefault();
                handleInput(key);
            }
            if (key === '*') { e.preventDefault(); handleInput('*'); }
            if (key === '/') { e.preventDefault(); handleInput('/'); }

            // Actions
            if (key === 'Enter' || key === '=') {
                e.preventDefault();
                handleCalculate();
            }
            if (key === 'Backspace') {
                e.preventDefault();
                handleBackspace();
            }
            if (key === 'Escape') {
                e.preventDefault();
                handleClear();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCalculatorActive, input, isResultFinal, result]); // Dependencies for closure state

    const Button = ({ label, value, onClick, className = '', highlight = false, secondary = false, wide = false }: any) => (
        <button
            onClick={() => onClick ? onClick() : handleInput(value || label)}
            className={`
                text-lg font-bold rounded-lg transition-all active:scale-95 flex items-center justify-center select-none
                ${highlight 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                    : secondary 
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700'
                }
                ${wide ? 'col-span-2' : ''}
                ${className}
            `}
        >
            {label}
        </button>
    );

    return (
        <div className="flex h-full bg-white dark:bg-surface text-gray-900 dark:text-white overflow-hidden">
            
            {/* Left: Keypad & Display */}
            <div className="flex-1 flex flex-col p-4 sm:p-6 min-w-[300px]">
                
                {/* Display Screen */}
                <div className="bg-gray-50 dark:bg-black border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-6 mb-4 flex flex-col justify-end shadow-inner h-32 sm:h-40 relative overflow-hidden">
                    {/* Previous Result / History Hint */}
                    {isResultFinal && (
                        <div className="text-gray-400 text-xs font-mono mb-1 text-right animate-slide-up-fade">
                            = {Number(result).toLocaleString('en-US')}
                        </div>
                    )}
                    
                    {/* Main Input Area */}
                    <div 
                        ref={displayRef}
                        className="text-3xl sm:text-4xl font-black font-mono tracking-wider overflow-x-auto whitespace-nowrap text-right w-full no-scrollbar"
                    >
                        {input ? formatExpression(input) : <span className="text-gray-300 dark:text-neutral-700">0</span>}
                    </div>
                </div>

                {/* Keypad Grid */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3 flex-1 h-full min-h-0">
                    {/* Row 1 */}
                    <Button label="C" onClick={handleClear} className="text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100" />
                    <Button label={<Delete size={20} />} onClick={handleBackspace} className="text-gray-500 hover:text-red-500" />
                    <Button label="%" value="%" secondary />
                    <Button label="÷" value="/" secondary />

                    {/* Row 2 */}
                    <Button label="7" value="7" />
                    <Button label="8" value="8" />
                    <Button label="9" value="9" />
                    <Button label="×" value="*" secondary />

                    {/* Row 3 */}
                    <Button label="4" value="4" />
                    <Button label="5" value="5" />
                    <Button label="6" value="6" />
                    <Button label="-" value="-" secondary />

                    {/* Row 4 */}
                    <Button label="1" value="1" />
                    <Button label="2" value="2" />
                    <Button label="3" value="3" />
                    <Button label="+" value="+" secondary />

                    {/* Row 5 */}
                    <Button label="(" value="(" secondary />
                    <Button label=")" value=")" secondary />
                    <Button label="0" value="0" />
                    <Button label="." value="." />

                    {/* Row 6 */}
                    <Button label="=" onClick={handleCalculate} highlight className="col-span-4" />
                </div>
            </div>

            {/* Right: History (Hidden on very small screens) */}
            <div className="w-64 sm:w-72 bg-gray-50 dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 flex flex-col hidden md:flex">
                <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <History size={16} />
                        تاریخچه
                    </h3>
                    {history.length > 0 && (
                        <button onClick={() => setHistory([])} className="text-gray-400 hover:text-red-500">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {history.length === 0 ? (
                        <div className="text-center text-gray-400 text-xs mt-10 opacity-50 flex flex-col items-center">
                            <CalculatorIcon size={32} className="mb-2" />
                            هنوز محاسباتی انجام نشده
                        </div>
                    ) : (
                        history.map((item) => (
                            <div 
                                key={item.id} 
                                className="p-3 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
                                onClick={() => {
                                    setInput(item.result);
                                    setResult('');
                                    setIsResultFinal(true);
                                }}
                            >
                                <div className="text-xs text-gray-500 font-mono mb-1 dir-ltr text-right truncate" title={item.expression}>
                                    {item.expression.replace(/\*/g, '×').replace(/\//g, '÷')}
                                </div>
                                <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 text-left dir-ltr">
                                    = {Number(item.result).toLocaleString('en-US')}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
