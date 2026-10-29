import numpy as np
import matplotlib.pyplot as plt

def rtphistorydiagram(rtphistory):
    fig, ax = plt.subplots(num=None, figsize=(16,12),dpi=300, facecolor='w', edgecolor='k')
    n=len(rtphistory)
    x1=[r for r in range(n)]
    y1=[rtphistory[s] for s in range(n)]
    y2=[1 for s in range(n)]    
    plt.plot(x1, y1, c="royalblue")
    plt.plot(x1, y2, c="crimson")    
    yboom=[1 for s in Oboom]    
    plt.scatter(Oboom, yboom , s= 100, color= "navy")
    ydelta=[1.1 for s in capture]
    plt.scatter(capture, ydelta , s= 100, color= "goldenrod")
    plt.grid()
    plt.show()    


def statdiagram(stat):    
    #global stat
    statkeys= list(stat.keys())
    statkeys.sort()
    
    fig, ax = plt.subplots(num=None, figsize=(16,12),dpi=300, facecolor='w', edgecolor='k')
    x1=[r for r in statkeys]
    y1=[stat[s] for s in statkeys]
    plt.bar(x1, y1, color="royalblue")
    plt.show()
    
def powershift():
    global power
    if power<2.5:
        power+=0.1
        return round(power,1)

def squaredsum(a,c):
    s=0
    for i in a:
        s+=(i-c)*(i-c)
    return s

def avesquaredsum(a,c):
    s=0
    for i in a:
        s+=(i-c)*(i-c)
    return s/len(a)

def getKeysByValue(dictOfElements, valueToFind):
    listOfKeys = list()
    listOfItems = dictOfElements.items()
    for item  in listOfItems:
        if item[1] == valueToFind:
            listOfKeys.append(item[0])
    return  listOfKeys

def targetfunction(a):
    if len(a)>50:
        a=a[-50:]       
    b=sorted(a)
    M=max(b)
    m=min(b)
    c=b.copy()
    c.remove(M)
    c.remove(m)
    target={}
    Tave=sum(a)/len(a)    
    for i in range(len(c)-2):
        for j in range(1,len(c)-i-1):            
            target[(i,j)]=avesquaredsum(c[:i+1],m)+avesquaredsum(c[i+1:i+j+1],Tave)+avesquaredsum(c[i+j+1:],M)        
    index=getKeysByValue(target, min(target.values()))[0]            
    lowerhalf=c[:index[0]+1]+[m]
    middle=c[index[0]+1:index[0]+index[1]+1]
    higherhalf=c[index[0]+index[1]+1:]+[M]
    avemiddle=sum(middle)/len(middle)
    avelowerhalf=sum(lowerhalf)/len(lowerhalf)
    avehigherhalf=sum(higherhalf)/len(higherhalf)
    #print(target)
    
    #print("A",(lowerhalf), (middle), (higherhalf))
    if len(higherhalf)>max(len(lowerhalf),len(middle)):
        return avehigherhalf
    elif len(middle)>max(len(lowerhalf),len(higherhalf)):
        return avemiddle
    else:
        return avelowerhalf
        
stat={} #rtp vs # of appearance

powerstat={}
cycles=10**1
grandrtphistory=0
grandplacedbets=0
grandgainedbonus=0

oddstat={}
power=1
suppresscount=0
Oboomactivate=1

for s in range(cycles):
    testrounds=10**2
    placedbets=0
    gainedbonus=0
    rtphistory=[0]
    duration=0
    pastbehavior=[]   
    boom=[2,4,8,16,20]
    pro=[0]*10+[1]
    #a=[2,2,2,2,2,2,8,2,5.9,2,6,2,2,2,4,2,2]
    #a=[e*(1+np.random.choice(pro)*np.random.choice(boom)) for e in a]
    capture=[]
    Oboom=[]
    for i in range(testrounds):
        thisbets=1+np.random.choice(pro)*np.random.choice(boom) #np.random.randint(1,100)
        pastbehavior.append(thisbets)
        
        placedbets+=thisbets
        grandplacedbets+=thisbets
        roll=np.random.uniform(0,1)
        playerleft=np.random.uniform()
        #print(roll, playerleft)
        roots=pow(roll, 1/power)
        odds=round(1/roots,2)
        
        playerroots=pow(playerleft, 1/power)
        playerodds=round(1/playerroots,2)
        
        if len(pastbehavior[:i])>4:
            bar=targetfunction(pastbehavior[:i])
            if pastbehavior[i]>2*bar: #彈跳倍數=2
                #modifiedcapture=[e-a.index(a[t-50]) if len(a[:t])>50 else e-a.index(a[0]) for e in capture]
                #print(modifiedcapture, capture)
                #successivecount=len([a[:t].index(e) for e in a[-50:t] if e in capture])
                #print(successivecount)
                capture.append(i)
                
        
        if rtphistory[-1]>1.2 and Oboomactivate:
            duration+=1
            if duration>5 or int(i in capture):
                if np.random.uniform()<0.3:
                    odds=round(np.random.uniform(1, 1.05),2)                
                    Oboom.append(i)
                    #print("# of test cycle:",s,"suppress!!!!!")                
                    powershift()
                    suppresscount+=1            
        else:
            duration=0
            power=1

        if round(power,1) not in powerstat:
            powerstat[round(power,1)]=1
        else:
            powerstat[round(power,1)]+=1
        
        if playerodds<= odds:
            if playerodds<360:
                gainedbonus+=playerodds*thisbets
                grandgainedbonus+=playerodds*thisbets
                if playerodds not in oddstat:
                    oddstat[playerodds]=1
                else:
                    oddstat[playerodds]+=1
                
            else:
                gainedbonus+=360*thisbets
                grandgainedbonus+=360*thisbets
                if 360 not in oddstat:
                    oddstat[360]=1
                else:
                    oddstat[360]+=1
        #else:
            #print("boom", playerodds, odds)
            
        rtp=gainedbonus/placedbets        
        rtphistory.append(rtp)
    rtplocate=int(rtp*10)/10
    #print(rtplocate)
    if rtplocate not in stat:
        stat[rtplocate]=1
    else:
        stat[rtplocate]+=1
    #rtphistorydiagram(rtphistory)
    
    '''
    fig, ax = plt.subplots(num=None, figsize=(16,12),dpi=300, facecolor='w', edgecolor='k')
    x1=[r for r in range(testrounds)]
    y1=[pastbehavior[s] for s in range(testrounds)]
    cc=['colors']*testrounds
    for n,val in enumerate(y1):
        if n in capture:
            cc[n]='goldenrod'
        else:
            cc[n]='cornflowerblue'
    plt.bar(x1, y1, color=cc)
    plt.show()
    '''

print("total RTP=", grandgainedbonus/grandplacedbets, suppresscount/cycles) 


#for e in sorted(stat):
#    print(e, stat[e])


oddstatkeys= list(oddstat.keys())
oddstatkeys.sort()

fig, ax = plt.subplots(num=None, figsize=(16,12),dpi=300, facecolor='w', edgecolor='k')
x1=[r for r in oddstatkeys]
y1=[oddstat[s] for s in oddstatkeys]
plt.plot(x1, y1, color="royalblue")
plt.show()

statdiagram(stat)


powerstatkeys= list(powerstat.keys())
powerstatkeys.sort()

fig, ax = plt.subplots(num=None, figsize=(16,12),dpi=300, facecolor='w', edgecolor='k')
x1=[r for r in powerstatkeys]
y1=[np.log10(powerstat[s]) for s in powerstatkeys]
plt.bar(x1, y1, color="royalblue", width=0.01)
plt.show()
