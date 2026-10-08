// Windows-only helper. .NET Framework 4.x is an OS component on supported Windows 10/11.
// No shell; a suspended worker is assigned to a kill-on-close Job Object before ResumeThread.
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using System.Runtime.InteropServices;
class ProcessHost {
  [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS { public ulong a,b,c,d,e,f; }
  [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMIT { public long a,b; public uint flags; public UIntPtr c,d; public uint e; public UIntPtr f; public uint g,h; }
  [StructLayout(LayoutKind.Sequential)] struct EXT_LIMIT { public BASIC_LIMIT basic; public IO_COUNTERS io; public UIntPtr a,b,c,d; }
  [StructLayout(LayoutKind.Sequential)] struct ACCOUNT { public long a,b,c,d; public uint e,total,active,terminated; }
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct STARTUP { public int cb; public string reserved,desktop,title; public int x,y,w,h,cx,cy,fill,flags; public short show,reserved2; public IntPtr reservedPtr,stdin,stdout,stderr; }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS { public IntPtr process,thread; public uint pid,tid; }
  [StructLayout(LayoutKind.Sequential)] struct SECURITY {public int length;public IntPtr descriptor;public int inherit;}
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr a,string name);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int info,ref EXT_LIMIT value,int length);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int info,out ACCOUNT value,int length,IntPtr returned);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint code);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string exe,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref STARTUP startup,out PROCESS process);
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
  [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int number);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateFile(string name,uint access,uint share,ref SECURITY security,uint creation,uint flags,IntPtr template);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool MoveFileEx(string from,string to,uint flags);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetFileAttributes(string name);
  static volatile bool cancel=false;
  static readonly IntPtr Invalid=new IntPtr(-1);
  static string Quote(string s) { // CommandLineToArgvW / CRT escaping, including empty args and trailing backslashes.
    StringBuilder b=new StringBuilder("\"");int slashes=0;
    foreach(char c in s){if(c=='\\'){slashes++;continue;}if(c=='"'){b.Append('\\',slashes*2+1);b.Append(c);}else{b.Append('\\',slashes);b.Append(c);}slashes=0;}
    b.Append('\\',slashes*2);b.Append('"');return b.ToString();
  }
  static void Status(string json){Console.Error.WriteLine("ATL_HELPER "+json);Console.Error.Flush();}
  static int Fail(string where){Status("{\"error\":\""+where+"\",\"win32\":"+Marshal.GetLastWin32Error()+"}");return 125;}
  static void Control(){try {Console.ReadLine();}catch{}cancel=true;}
  static int Run(string[] args){
    IntPtr job=CreateJobObject(IntPtr.Zero,null);if(job==IntPtr.Zero)return Fail("create-job");
    PROCESS p=new PROCESS();IntPtr nul=Invalid;
    try {
      EXT_LIMIT limit=new EXT_LIMIT();limit.basic.flags=0x2000;
      if(!SetInformationJobObject(job,9,ref limit,Marshal.SizeOf(limit)))return Fail("job-limit");
      SECURITY sa=new SECURITY();sa.length=Marshal.SizeOf(sa);sa.inherit=1;
      nul=CreateFile("NUL",0x80000000,3,ref sa,3,0,IntPtr.Zero);if(nul==Invalid)return Fail("stdin");
      STARTUP si=new STARTUP();si.cb=Marshal.SizeOf(si);si.flags=0x100;si.stdin=nul;si.stdout=GetStdHandle(-11);si.stderr=GetStdHandle(-12);
      if(!SetHandleInformation(si.stdout,1,1)||!SetHandleInformation(si.stderr,1,1))return Fail("inherit-pipes");
      StringBuilder command=new StringBuilder();for(int i=1;i<args.Length;i++){if(i>1)command.Append(' ');command.Append(Quote(args[i]));}
      if(!CreateProcess(args[1],command,IntPtr.Zero,IntPtr.Zero,true,0x08000004,IntPtr.Zero,Environment.CurrentDirectory,ref si,out p))return Fail("create-suspended");
      if(!AssignProcessToJobObject(job,p.process)){TerminateProcess(p.process,125);WaitForSingleObject(p.process,5000);return Fail("assign-job");}
      if(ResumeThread(p.thread)==0xffffffff){TerminateJobObject(job,125);return Fail("resume");}
      Status("{\"pid\":"+p.pid+",\"assignedBeforeResume\":true}");
      Thread control=new Thread(Control);control.IsBackground=true;control.Start();
      bool terminating=false;DateTime deadline=DateTime.MaxValue;
      while(true){
        if(cancel && !terminating){if(!TerminateJobObject(job,1223))return Fail("terminate-job");terminating=true;deadline=DateTime.UtcNow.AddSeconds(15);}
        bool rootDone=WaitForSingleObject(p.process,30)==0;
        ACCOUNT account;
        if(!QueryInformationJobObject(job,1,out account,Marshal.SizeOf(typeof(ACCOUNT)),IntPtr.Zero))return Fail("query-job");
        if(account.active==0){uint code;GetExitCodeProcess(p.process,out code);Status("{\"treeEmpty\":true,\"cancelled\":"+(cancel?"true":"false")+",\"exitCode\":"+code+"}");return cancel?1223:(int)code;}
        // A finished root must not leave background descendants running.
        if(rootDone && !terminating){if(!TerminateJobObject(job,125))return Fail("orphan-cleanup");terminating=true;deadline=DateTime.UtcNow.AddSeconds(15);}
        if(DateTime.UtcNow>deadline)return Fail("tree-timeout");
      }
    } finally {if(p.thread!=IntPtr.Zero)CloseHandle(p.thread);if(p.process!=IntPtr.Zero)CloseHandle(p.process);if(nul!=Invalid)CloseHandle(nul);CloseHandle(job);}
  }
  static void Pin(string name,bool file,List<IntPtr> handles){
    string full=Path.GetFullPath(name);if(full.StartsWith(@"\\"))throw new IOException("UNC not supported");
    string root=Path.GetPathRoot(full),current=root;
    string[] parts=full.Substring(root.Length).Split(new char[]{'\\'},StringSplitOptions.RemoveEmptyEntries);
    for(int i=0;i<parts.Length;i++){
      current=Path.Combine(current,parts[i]);uint attributes=GetFileAttributes(current);
      if(attributes==0xffffffff || (attributes&0x400)!=0)throw new IOException("Missing path or reparse point");
      bool isFile=file && i==parts.Length-1;SECURITY sa=new SECURITY();sa.length=Marshal.SizeOf(sa);
      IntPtr h=CreateFile(current,isFile?0x80000000u:0x80u,isFile?1u:3u,ref sa,3,0x02200000,IntPtr.Zero);
      if(h==Invalid)throw new IOException("Path cannot be pinned: "+Marshal.GetLastWin32Error());handles.Add(h);
      if((GetFileAttributes(current)&0x400)!=0)throw new IOException("Reparse point");
    }
  }
  static int Guard(string[] args){List<IntPtr> handles=new List<IntPtr>();try{for(int i=1;i<args.Length;i++)Pin(args[i],File.Exists(args[i]),handles);Console.WriteLine("READY");Console.Out.Flush();Console.ReadLine();return 0;}catch(Exception){return Fail("pin-path");}finally{foreach(IntPtr h in handles)CloseHandle(h);}}
  static int Main(string[] args){
    Console.OutputEncoding=new UTF8Encoding(false);
    try {
      if(args.Length==1 && args[0]=="--version"){Console.WriteLine("ATL ProcessHost 1.0.0");return 0;}
      if(args.Length>=2 && args[0]=="--run")return Run(args);
      if(args.Length>=2 && args[0]=="--guard")return Guard(args);
      // Same-volume atomic move; flags deliberately omit REPLACE_EXISTING and COPY_ALLOWED.
      if(args.Length==3 && args[0]=="--publish"){if(MoveFileEx(args[1],args[2],8)){Console.WriteLine("COMMITTED");return 0;}int e=Marshal.GetLastWin32Error();return (e==80||e==183)?80:Fail("publish");}
      return 64;
    }catch(Exception){return Fail("helper-exception");}
  }
}
