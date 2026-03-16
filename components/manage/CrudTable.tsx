import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Icon from '../ui/Icon';

export interface Column<T> {
    key: keyof T;
    label: string;
    type?: 'text' | 'select';
    options?: { label: string; value: string }[];
    render?: (value: any, item: T) => React.ReactNode;
}

interface CrudTableProps<T extends { id: string }> {
    columns: Column<T>[];
    data: T[];
    onSave: (data: T[]) => void;
    newItemFactory: () => T;
    itemName: string;
    hideAddButton?: boolean;
    isReadOnly?: boolean;
}

const CrudTable = <T extends { id: string },>({ columns, data, onSave, newItemFactory, itemName, hideAddButton = false, isReadOnly = false }: CrudTableProps<T>) => {
    const [localData, setLocalData] = useState<T[]>(data);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        setLocalData(data);
    }, [data]);

    const handleInputChange = (id: string, key: keyof T, value: string) => {
        setLocalData(prev => prev.map(item => item.id === id ? { ...item, [key]: value } : item));
    };

    const handleSaveRow = (id: string) => {
        onSave(localData);
        setEditingId(null);
    };

    const handleAddNew = () => {
        const newItem = newItemFactory();
        const updatedData = [newItem, ...localData];
        setLocalData(updatedData);
        setEditingId(newItem.id); 
    };

    const handleDelete = (id: string) => {
        if (window.confirm(`SECURITY PROTOCOL: Are you sure you want to permanently remove this ${itemName} from the vault? This action cannot be undone.`)) {
            const updatedData = localData.filter(item => item.id !== id);
            // Critical: Update parent state first to ensure UI doesn't flicker back
            onSave(updatedData);
            setLocalData(updatedData);
        }
    };

    const handleCancel = () => {
        setLocalData(data);
        setEditingId(null);
    };

    const renderEditor = (item: T, col: Column<T>) => {
        const commonClasses = "w-full p-2 border-2 border-slate-900 rounded bg-white text-xs outline-none font-bold text-black focus:ring-2 focus:ring-blue-600 shadow-sm";
        
        if (col.type === 'select' && col.options) {
            return (
                <select
                    value={(item[col.key] as string) || ''}
                    onChange={(e) => handleInputChange(item.id, col.key, e.target.value)}
                    className={commonClasses}
                >
                    {col.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            );
        }
        return (
            <input
                type="text"
                autoFocus={columns.indexOf(col) === 0}
                value={(item[col.key] as string) || ''}
                onChange={(e) => handleInputChange(item.id, col.key, e.target.value)}
                className={commonClasses}
                placeholder={col.label}
            />
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden font-sans">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                 <div>
                    <h4 className="font-black text-white text-xs uppercase tracking-widest">{itemName} Registry</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{localData.length} active records</p>
                 </div>
                 {!hideAddButton && !isReadOnly && (
                    <Button onClick={handleAddNew} variant="success" icon="fas fa-plus" size="sm" className="px-5 py-2.5 text-xs shadow-lg shadow-green-900/40">
                        Create New {itemName}
                    </Button>
                 )}
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                        <tr>
                            {columns.map(col => (
                                <th key={col.key as string} className="px-4 py-4 text-left font-black uppercase tracking-wider text-[10px] border-b border-slate-200">
                                    {col.label}
                                </th>
                            ))}
                            {!isReadOnly && <th className="px-4 py-4 text-center font-black uppercase tracking-wider text-[10px] border-b border-slate-200 w-32">Operations</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {localData.length === 0 ? (
                            <tr>
                                <td colSpan={isReadOnly ? columns.length : columns.length + 1} className="p-20 text-center text-slate-400">
                                    <Icon name="fas fa-database" className="text-5xl mb-4 opacity-10" />
                                    <p className="font-black uppercase tracking-widest text-xs">Database Partition Empty.</p>
                                </td>
                            </tr>
                        ) : (
                            localData.map(item => {
                                const isEditing = editingId === item.id;
                                return (
                                    <tr key={item.id} className={`${isEditing ? 'bg-blue-50/50' : 'hover:bg-slate-50/30'} transition-all`}>
                                        {columns.map(col => (
                                            <td key={col.key as string} className="px-4 py-3">
                                                {isEditing ? renderEditor(item, col) : (
                                                    <div className="text-black font-bold text-xs">
                                                        {col.render ? col.render(item[col.key], item) : String(item[col.key] || '-')}
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                        {!isReadOnly && (
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    {isEditing ? (
                                                        <>
                                                            <button 
                                                                onClick={() => handleSaveRow(item.id)} 
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-green-700 transition-all shadow-sm"
                                                            >
                                                                <Icon name="fas fa-check" />
                                                                <span>Save</span>
                                                            </button>
                                                            <button 
                                                                onClick={handleCancel} 
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-lg hover:bg-slate-300 transition-all shadow-sm"
                                                            >
                                                                <Icon name="fas fa-times" />
                                                                <span>Cancel</span>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button 
                                                                onClick={() => setEditingId(item.id)} 
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100"
                                                            >
                                                                <Icon name="fas fa-pen" />
                                                                <span>Edit</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(item.id)} 
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 text-[10px] font-black uppercase rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100"
                                                            >
                                                                <Icon name="fas fa-trash" />
                                                                <span>Delete</span>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CrudTable;